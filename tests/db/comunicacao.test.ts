import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, asSystem, asUser, createPerson, createTestDb, type TestDb } from "./helpers";

const run = TEST_DATABASE_URL ? describe : describe.skip;

run("Comunicação · avisos e comunicados", () => {
  let db: TestDb;
  let admin: string;
  let sup: string;
  let vera: string;
  let carlos: string;
  let track: string;
  let areaContabil: string;

  const inbox = async (who: string) => (await asUser(db.pool, who, (q) => q("select kind, title, link, read_at from notifications order by created_at"))).rows;

  beforeAll(async () => {
    db = await createTestDb();
    admin = await createPerson(db.pool, { name: "Ana Admin", email: "ana@x.com", role: "admin" });
    sup = await createPerson(db.pool, { name: "Sérgio Supervisor", email: "sergio@x.com", role: "supervisor" });
    vera = await createPerson(db.pool, { name: "Vera Vendedora", email: "vera@x.com", role: "colaborador", area: "Contábil", supervisorId: sup });
    carlos = await createPerson(db.pool, { name: "Carlos Financeiro", email: "carlos@x.com", role: "colaborador", area: "Serviços Financeiros" });
    areaContabil = (await asSystem(db.pool, (q) => q("select id from areas where name = 'Contábil'"))).rows[0].id;
    track = (await asSystem(db.pool, (q) => q("insert into tracks (name, status) values ('Trilha de avisos', 'publicado') returning id"))).rows[0].id;
  }, 60_000);

  afterAll(async () => {
    await db?.drop();
  });

  it("matrícula gera aviso só para a própria pessoa", async () => {
    await asSystem(db.pool, (q) => q("insert into enrollments (profile_id, track_id, due_date) values ($1, $2, current_date + 2)", [vera, track]));
    const mine = (await inbox(vera)).filter((n) => n.link === `/minhas-trilhas/${track}`);
    expect(mine).toEqual([expect.objectContaining({ kind: "matricula", title: "Nova trilha: Trilha de avisos", read_at: null })]);
    expect((await inbox(carlos)).filter((n) => n.link === `/minhas-trilhas/${track}`)).toHaveLength(0);
  });

  it("prazo chegando aparece ao abrir o sistema, uma vez só", async () => {
    expect((await asUser(db.pool, vera, (q) => q("select public.sync_my_notifications() n"))).rows[0].n).toBe(1);
    expect((await asUser(db.pool, vera, (q) => q("select public.sync_my_notifications() n"))).rows[0].n).toBe(0);
    await asSystem(db.pool, (q) => q("update enrollments set due_date = current_date - 1 where profile_id = $1", [vera]));
    await asUser(db.pool, vera, (q) => q("select public.sync_my_notifications()"));
    expect((await inbox(vera)).filter((n) => n.link === `/minhas-trilhas/${track}`).map((n) => n.kind)).toEqual(["matricula", "prazo_proximo", "prazo_vencido"]);
  });

  it("marca como lido só os próprios avisos; não grava direto", async () => {
    const before = (await inbox(carlos)).filter((n) => !n.read_at).length;
    const veraUnread = (await inbox(vera)).filter((n) => !n.read_at).length;
    expect((await asUser(db.pool, vera, (q) => q("select public.mark_notifications_read() n"))).rows[0].n).toBe(veraUnread);
    expect((await inbox(vera)).every((n) => n.read_at)).toBe(true);
    expect((await inbox(carlos)).filter((n) => !n.read_at).length).toBe(before);
    await expect(asUser(db.pool, vera, (q) => q("insert into notifications (profile_id, kind, title) values ($1, 'comunicado', 'x')", [vera]))).rejects.toThrow(/permission denied/);
    await expect(asUser(db.pool, vera, (q) => q("update notifications set read_at = null"))).rejects.toThrow(/permission denied/);
  });

  it("comunicado vai só para o público; colaborador não cria nem vê rascunho", async () => {
    await expect(asUser(db.pool, vera, (q) => q("insert into announcements (title, body) values ('Oi', 'teste')"))).rejects.toThrow(/row-level security/);
    const id = await asUser(db.pool, admin, async (q) => {
      const a = (await q("insert into announcements (title, body, importance, created_by) values ('Festa de fim de ano', '**Dia 15**, no salão.', 'importante', $1) returning id", [admin])).rows[0].id;
      await q("insert into announcement_audience (announcement_id, area_id) values ($1, $2)", [a, areaContabil]);
      return a as string;
    });
    expect((await asUser(db.pool, vera, (q) => q("select id from announcements"))).rows).toHaveLength(0);
    const n = (await asUser(db.pool, admin, (q) => q("select public.publish_announcement($1) n", [id]))).rows[0].n;
    expect(n).toBe(1);
    const v = (await inbox(vera)).at(-1);
    expect(v).toMatchObject({ kind: "comunicado", title: "Festa de fim de ano", link: `/comunicados/${id}` });
    expect((await asUser(db.pool, vera, (q) => q("select title from announcements"))).rows).toEqual([{ title: "Festa de fim de ano" }]);
    expect((await asUser(db.pool, carlos, (q) => q("select title from announcements"))).rows).toHaveLength(0);
    await expect(asUser(db.pool, admin, (q) => q("select public.publish_announcement($1)", [id]))).rejects.toThrow(/já foi publicado/);
    await expect(asUser(db.pool, vera, (q) => q("select public.publish_announcement($1)", [id]))).rejects.toThrow(/não pode publicar/);
  });

  it("certificado emitido gera aviso", async () => {
    await asSystem(db.pool, async (q) => {
      const t = (await q("insert into tracks (name, status) values ('Trilha concluída', 'publicado') returning id")).rows[0].id;
      await q("insert into enrollments (profile_id, track_id, status, completed_at) values ($1, $2, 'concluida', now())", [carlos, t]);
    });
    expect((await inbox(carlos)).map((n) => n.kind)).toContain("certificado");
  });
});
