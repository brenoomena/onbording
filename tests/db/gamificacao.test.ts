import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, asSystem, asUser, createPerson, createTestDb, type TestDb } from "./helpers";

const run = TEST_DATABASE_URL ? describe : describe.skip;

run("Gamificação · pontos, medalhas e ranking", () => {
  let db: TestDb;
  let sup: string;
  let vera: string;
  let paula: string;
  let carlos: string;
  let track: string;
  let a: string;
  let b: string;
  let quiz: string;

  const ledger = async (who: string) => (await asSystem(db.pool, (q) => q("select reason, points from points_ledger where profile_id = $1 order by created_at, reason", [who]))).rows;
  const badges = async (who: string) => (await asSystem(db.pool, (q) => q("select badge_key from user_badges where profile_id = $1 order by badge_key", [who]))).rows.map((r) => r.badge_key);

  beforeAll(async () => {
    db = await createTestDb();
    sup = await createPerson(db.pool, { name: "Sérgio Supervisor", email: "sergio@x.com", role: "supervisor" });
    vera = await createPerson(db.pool, { name: "Vera Vendedora", email: "vera@x.com", role: "colaborador", area: "Contábil", supervisorId: sup });
    paula = await createPerson(db.pool, { name: "Paula Contábil", email: "paula@x.com", role: "colaborador", area: "Contábil" });
    carlos = await createPerson(db.pool, { name: "Carlos Financeiro", email: "carlos@x.com", role: "colaborador", area: "Serviços Financeiros" });
    await asSystem(db.pool, async (q) => {
      track = (await q("insert into tracks (name, status, is_sequential) values ('Trilha pontuada', 'publicado', false) returning id")).rows[0].id;
      const mod = (await q("insert into modules (track_id, title, position) values ($1, 'Módulo', 1) returning id", [track])).rows[0].id;
      a = (await q("insert into contents (title, kind, body, track_id, status) values ('Obrigatória', 'texto', 'x', $1, 'publicado') returning id", [track])).rows[0].id;
      b = (await q("insert into contents (title, kind, body, track_id, status) values ('Opcional', 'texto', 'y', $1, 'publicado') returning id", [track])).rows[0].id;
      quiz = (await q("insert into contents (title, kind, track_id, status, passing_score) values ('Prova', 'avaliacao', $1, 'publicado', 50) returning id", [track])).rows[0].id;
      await q("insert into module_items (module_id, content_id, position, is_required) values ($1, $2, 1, true), ($1, $3, 2, false), ($1, $4, 3, true)", [mod, a, b, quiz]);
      await q(
        `insert into quiz_questions (content_id, position, kind, prompt, points, options) values ($1, 1, 'vf', 'Certo?', 1, '[{"id":"v","label":"Verdadeiro","correct":true},{"id":"f","label":"Falso","correct":false}]')`,
        [quiz],
      );
      await q("insert into enrollments (profile_id, track_id, due_date) values ($1, $2, current_date + 10)", [vera, track]);
    });
  }, 60_000);

  afterAll(async () => {
    await db?.drop();
  });

  it("etapa obrigatória vale 10, opcional 5; primeira etapa dá a medalha", async () => {
    await asUser(db.pool, vera, (q) => q("select public.complete_content($1)", [a]));
    await asUser(db.pool, vera, (q) => q("select public.complete_content($1)", [b]));
    expect(await ledger(vera)).toEqual([
      { reason: "etapa_obrigatoria", points: 10 },
      { reason: "etapa_opcional", points: 5 },
    ]);
    expect(await badges(vera)).toEqual(["primeiros_passos"]);
    const n = (await asSystem(db.pool, (q) => q("select title, link from notifications where profile_id = $1 and kind = 'medalha'", [vera]))).rows;
    expect(n).toEqual([{ title: "Nova medalha: Primeiros passos", link: "/conquistas" }]);
  });

  it("aprovação de primeira com 100%: 20 + 10, medalhas; trilha no prazo: 50 + 25", async () => {
    const qid = (await asSystem(db.pool, (q) => q("select id from quiz_questions where content_id = $1", [quiz]))).rows[0].id;
    await asUser(db.pool, vera, (q) => q("select public.submit_quiz($1, $2::jsonb)", [quiz, JSON.stringify({ [qid]: { options: ["v"] } })]));
    const pts = await ledger(vera);
    expect(pts.map((p) => p.reason).sort()).toEqual(["avaliacao", "avaliacao_primeira", "etapa_obrigatoria", "etapa_opcional", "trilha", "trilha_no_prazo"]);
    expect(pts.reduce((s, p) => s + p.points, 0)).toBe(10 + 5 + 20 + 10 + 50 + 25);
    expect(await badges(vera)).toEqual(["de_primeira", "nota_maxima", "pontual", "primeiros_passos", "trilha_concluida"]);
  });

  it("nada pontua duas vezes", async () => {
    await asSystem(db.pool, async (q) => {
      await q("update enrollments set status = 'em_andamento' where profile_id = $1 and track_id = $2", [vera, track]);
      await q("update enrollments set status = 'concluida' where profile_id = $1 and track_id = $2", [vera, track]);
    });
    expect((await ledger(vera)).length).toBe(6);
  });

  it("ranking: colaborador vê só a própria área; supervisor vê outras", async () => {
    const r = (await asUser(db.pool, paula, (q) => q("select full_name, points, rank from public.points_ranking()"))).rows;
    expect(r).toEqual([
      { full_name: "Vera Vendedora", points: 120, rank: 1 },
      { full_name: "Paula Contábil", points: 0, rank: 2 },
    ]);
    const fin = (await asSystem(db.pool, (q) => q("select area_id from profiles where id = $1", [carlos]))).rows[0].area_id;
    await expect(asUser(db.pool, paula, (q) => q("select * from public.points_ranking($1)", [fin]))).rejects.toThrow(/sua área/);
    const s = (await asUser(db.pool, sup, (q) => q("select full_name from public.points_ranking($1)", [fin]))).rows;
    expect(s).toEqual([{ full_name: "Carlos Financeiro" }]);
    const me = (await asUser(db.pool, vera, (q) => q("select public.my_gamification() g"))).rows[0].g;
    expect(me).toMatchObject({ total: 120, month: 120, rank_total: 1, rank_month: 1, area_size: 2, badges: 5 });
  });

  it("ninguém grava pontos ou medalhas direto; não lê os de quem não acompanha", async () => {
    await expect(asUser(db.pool, paula, (q) => q("insert into points_ledger (profile_id, points, reason, description, dedupe_key) values ($1, 999, 'trilha', 'x', 'x')", [paula]))).rejects.toThrow(/permission denied/);
    await expect(asUser(db.pool, paula, (q) => q("insert into user_badges (profile_id, badge_key) values ($1, 'nota_maxima')", [paula]))).rejects.toThrow(/permission denied/);
    expect((await asUser(db.pool, paula, (q) => q("select * from points_ledger"))).rows).toHaveLength(0);
    expect((await asUser(db.pool, sup, (q) => q("select * from points_ledger where profile_id = $1", [vera]))).rows.length).toBe(6);
  });

  it("constância: 5 dias seguidos de estudo", async () => {
    await asSystem(db.pool, async (q) => {
      for (let d = 4; d >= 0; d--) {
        await q("insert into learning_sessions (profile_id, content_id, started_at) values ($1, $2, now() - ($3 || ' days')::interval)", [paula, a, d]);
      }
    });
    expect(await badges(paula)).toEqual(["constancia"]);
  });
});
