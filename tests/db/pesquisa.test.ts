import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, asSystem, asUser, createPerson, createTestDb, type TestDb } from "./helpers";

const run = TEST_DATABASE_URL ? describe : describe.skip;

run("Pesquisa de satisfação", () => {
  let db: TestDb;
  let admin: string;
  let sup: string;
  let vera: string;
  let paula: string;
  let carlos: string;
  let track: string;
  let a: string;
  let b: string;
  let contabil: string;

  const inbox = async (who: string) =>
    (await asSystem(db.pool, (q) => q("select title, link, read_at from notifications where profile_id = $1 and kind = 'pesquisa' and link like '%' || $2 || '%'", [who, track]))).rows;
  const report = (who: string, from: string | null = null, to: string | null = null, area: string | null = null) =>
    asUser(db.pool, who, (q) => q("select public.feedback_report($1::date, $2::date, $3::uuid) r", [from, to, area])).then((r) => r.rows[0].r);

  beforeAll(async () => {
    db = await createTestDb();
    admin = await createPerson(db.pool, { name: "Ana Admin", email: "ana@x.com", role: "admin" });
    sup = await createPerson(db.pool, { name: "Sérgio Supervisor", email: "sergio@x.com", role: "supervisor" });
    vera = await createPerson(db.pool, { name: "Vera Vendedora", email: "vera@x.com", role: "colaborador", area: "Contábil", supervisorId: sup });
    paula = await createPerson(db.pool, { name: "Paula Contábil", email: "paula@x.com", role: "colaborador", area: "Contábil" });
    carlos = await createPerson(db.pool, { name: "Carlos Financeiro", email: "carlos@x.com", role: "colaborador", area: "Serviços Financeiros" });
    contabil = (await asSystem(db.pool, (q) => q("select id from areas where name = 'Contábil'"))).rows[0].id;
    await asSystem(db.pool, async (q) => {
      track = (await q("insert into tracks (name, status, is_sequential) values ('Boas-vindas', 'publicado', false) returning id")).rows[0].id;
      const mod = (await q("insert into modules (track_id, title, position) values ($1, 'Módulo', 1) returning id", [track])).rows[0].id;
      a = (await q("insert into contents (title, kind, body, track_id, status) values ('Nossa história', 'texto', 'x', $1, 'publicado') returning id", [track])).rows[0].id;
      b = (await q("insert into contents (title, kind, body, track_id, status) values ('Valores', 'texto', 'y', $1, 'publicado') returning id", [track])).rows[0].id;
      await q("insert into module_items (module_id, content_id, position, is_required) values ($1, $2, 1, true), ($1, $3, 2, true)", [mod, a, b]);
      for (const p of [vera, paula, carlos]) await q("insert into enrollments (profile_id, track_id) values ($1, $2)", [p, track]);
    });
  }, 60_000);

  afterAll(async () => {
    await db?.drop();
  });

  it("só avalia a trilha depois de concluir", async () => {
    await expect(asUser(db.pool, vera, (q) => q("select public.submit_track_feedback($1, 5, null, false)", [track]))).rejects.toThrow(/depois de concluí-la/);
    await expect(asUser(db.pool, vera, (q) => q("select public.submit_content_feedback($1, 5, null, false)", [a]))).rejects.toThrow(/depois de concluí-lo/);
  });

  it("ao concluir a trilha, chega o convite no sininho (uma vez)", async () => {
    await asUser(db.pool, vera, (q) => q("select public.complete_content($1)", [a]));
    await asUser(db.pool, vera, (q) => q("select public.complete_content($1)", [b]));
    const inv = await inbox(vera);
    expect(inv).toHaveLength(1);
    expect(inv[0].title).toBe("Como foi a trilha Boas-vindas?");
    expect(inv[0].link).toBe(`/minhas-trilhas/${track}?avaliar=1`);
    expect(inv[0].read_at).toBeNull();
    await asSystem(db.pool, (q) => q("update enrollments set status = 'em_andamento' where profile_id = $1 and track_id = $2", [vera, track]));
    await asSystem(db.pool, (q) => q("update enrollments set status = 'concluida' where profile_id = $1 and track_id = $2", [vera, track]));
    expect(await inbox(vera)).toHaveLength(1);
  });

  it("valida a nota e grava (e atualiza) a avaliação; o convite fica lido", async () => {
    await expect(asUser(db.pool, vera, (q) => q("select public.submit_track_feedback($1, 6, null, false)", [track]))).rejects.toThrow(/1 a 5/);
    await asUser(db.pool, vera, (q) => q("select public.submit_track_feedback($1, 3, '  Boa  ', false)", [track]));
    await asUser(db.pool, vera, (q) => q("select public.submit_track_feedback($1, 4, 'Muito boa, mas longa', true)", [track]));
    const mine = (await asUser(db.pool, vera, (q) => q("select rating, comment, anonymous from track_feedback"))).rows;
    expect(mine).toEqual([{ rating: 4, comment: "Muito boa, mas longa", anonymous: true }]);
    expect((await inbox(vera))[0].read_at).not.toBeNull();
    await asUser(db.pool, vera, (q) => q("select public.submit_content_feedback($1, 5, 'Adorei', false)", [a]));
    await asUser(db.pool, vera, (q) => q("select public.submit_content_feedback($1, 2, '', false)", [b]));
  });

  it("cada um lê só as próprias avaliações; ninguém grava direto", async () => {
    expect((await asUser(db.pool, paula, (q) => q("select count(*)::int n from track_feedback"))).rows[0].n).toBe(0);
    expect((await asUser(db.pool, admin, (q) => q("select count(*)::int n from content_feedback"))).rows[0].n).toBe(0);
    await expect(
      asUser(db.pool, paula, (q) => q("insert into track_feedback (enrollment_id, profile_id, track_id, rating) select id, profile_id, track_id, 1 from enrollments where profile_id = $1", [paula])),
    ).rejects.toThrow();
  });

  it("relatório: só com a permissão; médias, distribuição, taxa e anonimato", async () => {
    await expect(report(sup)).rejects.toThrow(/Sem permissão/);
    await asUser(db.pool, paula, (q) => q("select public.complete_content($1)", [a]));
    await asUser(db.pool, paula, (q) => q("select public.complete_content($1)", [b]));
    await asUser(db.pool, paula, (q) => q("select public.submit_track_feedback($1, 2, 'Faltou prática', false)", [track]));
    await asUser(db.pool, carlos, (q) => q("select public.complete_content($1)", [a]));
    await asUser(db.pool, carlos, (q) => q("select public.complete_content($1)", [b])); // concluiu e não avaliou

    const r = await report(admin);
    expect(r.summary).toMatchObject({ track_responses: 2, track_avg: 3, completions: 3, content_responses: 2, content_avg: 3.5 });
    expect(r.summary.track_dist).toEqual([0, 1, 0, 1, 0]);
    expect(r.tracks).toEqual([{ id: track, name: "Boas-vindas", completions: 3, responses: 2, avg: 3, dist: [0, 1, 0, 1, 0], comments: 2 }]);
    expect(r.contents.map((c: { title: string; avg: number }) => [c.title, c.avg])).toEqual([["Nossa história", 5], ["Valores", 2]]);
    const byText = Object.fromEntries(r.comments.map((c: { comment: string; author: string | null; area: string | null }) => [c.comment, [c.author, c.area]]));
    expect(byText["Muito boa, mas longa"]).toEqual([null, null]); // anônima
    expect(byText["Faltou prática"]).toEqual(["Paula Contábil", "Contábil"]);
    expect(byText["Adorei"]).toEqual(["Vera Vendedora", "Contábil"]);
    expect(r.comments).toHaveLength(3);
  });

  it("relatório filtra por área e período", async () => {
    const fin = (await asSystem(db.pool, (q) => q("select id from areas where name = 'Serviços Financeiros'"))).rows[0].id;
    const r = await report(admin, null, null, fin);
    expect(r.summary).toMatchObject({ track_responses: 0, completions: 1 });
    expect(r.tracks[0]).toMatchObject({ responses: 0, completions: 1, avg: null });
    const c = await report(admin, null, null, contabil);
    expect(c.summary).toMatchObject({ track_responses: 2, completions: 2 });
    const old = await report(admin, "2020-01-01", "2020-12-31");
    expect(old).toMatchObject({ tracks: [], contents: [], comments: [] });
    expect(old.summary.track_responses).toBe(0);
  });

  it("a permissão pode ser dada a outro papel", async () => {
    await asSystem(db.pool, (q) =>
      q("insert into role_permissions (role_id, permission_key) select r.id, 'pesquisa.ver' from roles r where r.key = 'supervisor' on conflict do nothing"),
    );
    expect((await report(sup)).summary.track_responses).toBe(2);
  });
});
