import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, asSystem, asUser, createPerson, createTestDb, type TestDb } from "./helpers";

const run = TEST_DATABASE_URL ? describe : describe.skip;

run("E-mails · fila, lembretes e preferências", () => {
  let db: TestDb;
  let admin: string;
  let sup: string;
  let vera: string;
  let carlos: string;
  let opcional: string;
  let obrigatoria: string;

  const outbox = async (who?: string) =>
    (await asSystem(db.pool, (q) => q("select kind, subject, data, dedupe_key, status, to_email from email_outbox where ($1::uuid is null or profile_id = $1) order by created_at", [who ?? null]))).rows;
  const jobs = async (day: string) => (await asSystem(db.pool, (q) => q("select public.run_email_jobs($1::date) r", [day]))).rows[0].r;

  beforeAll(async () => {
    db = await createTestDb();
    admin = await createPerson(db.pool, { name: "Ana Admin", email: "ana@x.com", role: "admin" });
    sup = await createPerson(db.pool, { name: "Sérgio Supervisor", email: "sergio@x.com", role: "supervisor" });
    vera = await createPerson(db.pool, { name: "Vera Vendedora", email: "vera@x.com", role: "colaborador", supervisorId: sup });
    carlos = await createPerson(db.pool, { name: "Carlos Financeiro", email: "carlos@x.com", role: "colaborador", supervisorId: sup });
    opcional = (await asSystem(db.pool, (q) => q("insert into tracks (name, status) values ('Trilha opcional', 'publicado') returning id"))).rows[0].id;
    obrigatoria = (await asSystem(db.pool, (q) => q("insert into tracks (name, status, is_mandatory) values ('Trilha obrigatória', 'publicado', true) returning id"))).rows[0].id;
  }, 60_000);

  afterAll(async () => {
    await db?.drop();
  });

  it("matrícula nova entra na fila com o primeiro nome", async () => {
    await asSystem(db.pool, (q) => q("insert into enrollments (profile_id, track_id, due_date) values ($1, $2, '2026-11-12')", [vera, opcional]));
    const mine = await outbox(vera);
    expect(mine).toEqual([expect.objectContaining({ kind: "matricula", subject: "Nova trilha: Trilha opcional", status: "pendente", to_email: "vera@x.com" })]);
    expect(mine[0].data.name).toBe("Vera");
    expect(mine[0].data.link).toBe(`/minhas-trilhas/${opcional}`);
  });

  it("colaborador não vê a fila; administrador vê", async () => {
    expect((await asUser(db.pool, vera, (q) => q("select count(*)::int n from email_outbox"))).rows[0].n).toBe(0);
    expect((await asUser(db.pool, admin, (q) => q("select count(*)::int n from email_outbox"))).rows[0].n).toBeGreaterThan(0);
    await expect(asUser(db.pool, admin, (q) => q("update email_outbox set status = 'enviado'"))).rejects.toThrow();
    await expect(asUser(db.pool, vera, (q) => q("select public.run_email_jobs()"))).rejects.toThrow();
    await expect(asUser(db.pool, admin, (q) => q("select * from public.claim_email_batch(10)"))).rejects.toThrow();
  });

  it("prazo: 3 dias antes e no dia, sem repetir ao rodar de novo", async () => {
    expect((await jobs("2026-11-09")).prazo).toBe(1); // 12/11 - 3
    expect((await jobs("2026-11-09")).prazo).toBe(1); // roda de novo: mesma chave, nada novo
    expect((await jobs("2026-11-10")).prazo).toBe(0);
    expect((await jobs("2026-11-12")).prazo).toBe(1); // no dia
    const prazos = (await outbox(vera)).filter((e) => e.kind === "prazo_proximo");
    expect(prazos.map((e) => e.subject)).toEqual(["Prazo chegando: Trilha opcional", "Vence hoje: Trilha opcional"]);
    expect(prazos[0].data.days).toBe(3);
  });

  it("atraso: um e-mail por prazo; quem desligou lembretes não recebe de trilha opcional", async () => {
    await asSystem(db.pool, (q) => q("insert into enrollments (profile_id, track_id, due_date) values ($1, $2, '2026-11-12')", [vera, obrigatoria]));
    await asUser(db.pool, vera, (q) => q("insert into email_preferences (profile_id, lembretes) values ($1, false)", [vera]));
    await jobs("2026-11-13");
    await jobs("2026-11-14");
    const late = (await outbox(vera)).filter((e) => e.kind === "prazo_vencido");
    expect(late.map((e) => e.subject)).toEqual(["Prazo vencido: Trilha obrigatória"]);
    expect(late[0].data.mandatory).toBe(true);
    // Atrasos com mais de 7 dias não disparam e-mail.
    await asSystem(db.pool, (q) => q("insert into enrollments (profile_id, track_id, due_date) values ($1, $2, '2026-10-01')", [carlos, obrigatoria]));
    await jobs("2026-11-14");
    expect((await outbox(carlos)).filter((e) => e.kind === "prazo_vencido")).toHaveLength(0);
  });

  it("atraso na equipe: supervisor recebe aviso e e-mail, uma vez por prazo", async () => {
    // Vera (equipe do Sérgio) tem a trilha obrigatória vencida em 12/11.
    const supInbox = async () => (await asSystem(db.pool, (q) => q("select kind, title, link from notifications where profile_id = $1 and kind = 'equipe_atraso'", [sup]))).rows;
    expect((await supInbox()).map((n) => n.title)).toEqual(expect.arrayContaining(["Atraso na equipe: Vera Vendedora"]));
    const before = (await supInbox()).length;
    expect((await jobs("2026-11-14")).equipe).toBeGreaterThanOrEqual(1);
    expect((await supInbox()).length).toBe(before);
    const mails = (await outbox(sup)).filter((e) => e.kind === "equipe_atraso");
    expect(mails.map((e) => e.subject)).toEqual(expect.arrayContaining(["Atraso na equipe: Vera Vendedora"]));
    expect(new Set(mails.map((e) => e.dedupe_key)).size).toBe(mails.length);
    expect(mails[0].data.link).toBe(`/colaboradores/${vera}`);
    // Vera desligou lembretes, mas o supervisor recebe do mesmo jeito; Vera não recebe o aviso da equipe.
    expect((await outbox(vera)).some((e) => e.kind === "equipe_atraso")).toBe(false);
  });

  it("atraso na equipe aparece no sininho do supervisor ao abrir o sistema", async () => {
    const t = (await asSystem(db.pool, (q) => q("insert into tracks (name, status) values ('Atrasada ontem', 'publicado') returning id"))).rows[0].id;
    await asSystem(db.pool, (q) => q("insert into enrollments (profile_id, track_id, due_date) values ($1, $2, current_date - 1)", [carlos, t]));
    await asUser(db.pool, sup, (q) => q("select public.sync_my_notifications()"));
    const n = (await asUser(db.pool, sup, (q) => q("select title, body from notifications where kind = 'equipe_atraso' and title = 'Atraso na equipe: Carlos Financeiro'"))).rows;
    expect(n).toHaveLength(1);
    expect(n[0].body).toContain('"Atrasada ontem" venceu em');
    // Quem não é supervisor de Carlos não recebe.
    await asUser(db.pool, vera, (q) => q("select public.sync_my_notifications()"));
    expect((await asUser(db.pool, vera, (q) => q("select count(*)::int n from notifications where kind = 'equipe_atraso'"))).rows[0].n).toBe(0);
  });

  it("supervisor pode desligar só o e-mail do atraso na equipe", async () => {
    await asUser(db.pool, sup, (q) => q("insert into email_preferences (profile_id, equipe) values ($1, false) on conflict (profile_id) do update set equipe = false", [sup]));
    const t = (await asSystem(db.pool, (q) => q("insert into tracks (name, status) values ('Outra atrasada', 'publicado') returning id"))).rows[0].id;
    await asSystem(db.pool, (q) => q("insert into enrollments (profile_id, track_id, due_date) values ($1, $2, '2026-11-13')", [carlos, t]));
    await jobs("2026-11-15");
    expect((await outbox(sup)).some((e) => e.subject === "Atraso na equipe: Carlos Financeiro" && e.data.track === "Outra atrasada")).toBe(false);
    expect((await asSystem(db.pool, (q) => q("select count(*)::int n from notifications where profile_id = $1 and body like '\"Outra atrasada\"%'", [sup]))).rows[0].n).toBe(1);
  });

  it("preferência: cada um só mexe na própria", async () => {
    await expect(asUser(db.pool, carlos, (q) => q("insert into email_preferences (profile_id, resumo) values ($1, false)", [vera]))).rejects.toThrow();
    const r = await asUser(db.pool, carlos, (q) => q("update email_preferences set lembretes = true where profile_id = $1 returning 1", [vera]));
    expect(r.rowCount).toBe(0);
  });

  it("resumo semanal: só na segunda, para quem tem equipe", async () => {
    expect((await jobs("2026-11-15")).resumo).toBe(0); // domingo
    expect((await jobs("2026-11-16")).resumo).toBe(1); // segunda
    // 09/11 também foi segunda (rodou no teste de prazo): fica o último.
    const resumo = (await outbox(sup)).filter((e) => e.kind === "resumo_semanal").pop();
    expect(resumo.data.week).toBe("16/11/2026");
    expect(resumo.subject).toBe("Resumo semanal da sua equipe");
    expect(resumo.data.late).toBeGreaterThanOrEqual(1);
    expect(resumo.data.rows.map((x: { person: string }) => x.person)).toEqual(expect.arrayContaining(["Vera Vendedora", "Carlos Financeiro"]));
    expect((await outbox(vera)).some((e) => e.kind === "resumo_semanal")).toBe(false);
    await asUser(db.pool, sup, (q) => q("insert into email_preferences (profile_id, resumo) values ($1, false) on conflict (profile_id) do update set resumo = false", [sup]));
    expect((await jobs("2026-11-23")).resumo).toBe(0);
  });

  it("comunicado: só os importantes viram e-mail", async () => {
    const mk = async (title: string, importance: string) => {
      const id = (await asUser(db.pool, admin, (q) => q("insert into announcements (title, body, importance) values ($1, 'Texto', $2) returning id", [title, importance]))).rows[0].id;
      await asUser(db.pool, admin, (q) => q("select public.publish_announcement($1)", [id]));
    };
    await mk("Aviso comum", "normal");
    await mk("Mudança de horário", "importante");
    const subjects = (await outbox(carlos)).filter((e) => e.kind === "comunicado").map((e) => e.subject);
    expect(subjects).toEqual(["Mudança de horário"]);
  });

  it("configuração desliga um tipo para todos", async () => {
    await asSystem(db.pool, (q) => q(`update app_settings set email_settings = '{"kinds":{"matricula":false},"reminder_days":[7]}' where id = 1`));
    const t = (await asSystem(db.pool, (q) => q("insert into tracks (name, status) values ('Sem e-mail', 'publicado') returning id"))).rows[0].id;
    await asSystem(db.pool, (q) => q("insert into enrollments (profile_id, track_id, due_date) values ($1, $2, '2026-12-07')", [carlos, t]));
    expect((await outbox(carlos)).some((e) => e.subject === "Nova trilha: Sem e-mail")).toBe(false);
    expect((await jobs("2026-11-30")).prazo).toBe(1); // 7 dias antes
  });

  it("lote: reserva sem repetir e tenta de novo até 5 vezes", async () => {
    const a = (await asSystem(db.pool, (q) => q("select id from public.claim_email_batch(3)"))).rows;
    const b = (await asSystem(db.pool, (q) => q("select id from public.claim_email_batch(3)"))).rows;
    expect(a).toHaveLength(3);
    expect(b.some((x) => a.some((y) => y.id === x.id))).toBe(false);
    await asSystem(db.pool, (q) => q("update email_outbox set status = 'erro', attempts = 5 where id = $1", [a[0].id]));
    const all = (await asSystem(db.pool, (q) => q("select id from public.claim_email_batch(200)"))).rows;
    expect(all.some((x) => x.id === a[0].id)).toBe(false);
  });

  it("e-mail de teste: só administrador", async () => {
    const id = (await asUser(db.pool, admin, (q) => q("select public.queue_test_email() id"))).rows[0].id;
    expect(id).toBeTruthy();
    await expect(asUser(db.pool, vera, (q) => q("select public.queue_test_email()"))).rejects.toThrow(/administradores/);
  });
});
