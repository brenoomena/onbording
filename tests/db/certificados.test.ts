import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, asSystem, asUser, createPerson, createTestDb, type TestDb } from "./helpers";

const run = TEST_DATABASE_URL ? describe : describe.skip;

run("Certificados · emissão automática e validação pública", () => {
  let db: TestDb;
  let sup: string;
  let vera: string;
  let outro: string;
  let track: string;
  let a: string;
  let b: string;

  beforeAll(async () => {
    db = await createTestDb();
    sup = await createPerson(db.pool, { name: "Sérgio Supervisor", email: "sergio@x.com", role: "supervisor" });
    vera = await createPerson(db.pool, { name: "Vera Vendedora", email: "vera@x.com", role: "colaborador", area: "Contábil", supervisorId: sup });
    outro = await createPerson(db.pool, { name: "Otávio Outro", email: "otavio@x.com", role: "supervisor" });
    await asSystem(db.pool, async (q) => {
      track = (await q("insert into tracks (name, status, is_sequential) values ('Trilha do certificado', 'publicado', false) returning id")).rows[0].id;
      const mod = (await q("insert into modules (track_id, title, position) values ($1, 'Único', 1) returning id", [track])).rows[0].id;
      a = (await q("insert into contents (title, kind, body, track_id, status, estimated_minutes) values ('Aula A', 'texto', 'x', $1, 'publicado', 90) returning id", [track])).rows[0].id;
      b = (await q("insert into contents (title, kind, body, track_id, status, estimated_minutes) values ('Aula B', 'texto', 'y', $1, 'publicado', 45) returning id", [track])).rows[0].id;
      await q("insert into module_items (module_id, content_id, position, is_required) values ($1, $2, 1, true), ($1, $3, 2, true)", [mod, a, b]);
      await q("insert into enrollments (profile_id, track_id) values ($1, $2)", [vera, track]);
    });
  }, 60_000);

  afterAll(async () => {
    await db?.drop();
  });

  it("só emite quando a trilha é concluída, com nome, trilha e carga horária somada", async () => {
    await asUser(db.pool, vera, (q) => q("select public.complete_content($1)", [a]));
    let mine = await asUser(db.pool, vera, (q) => q("select * from certificates"));
    expect(mine.rows).toHaveLength(0);
    await asUser(db.pool, vera, (q) => q("select public.complete_content($1)", [b]));
    mine = await asUser(db.pool, vera, (q) => q("select * from certificates"));
    expect(mine.rows).toHaveLength(1);
    expect(mine.rows[0]).toMatchObject({ person_name: "Vera Vendedora", track_name: "Trilha do certificado", hours: "2.3", average_score: null });
    expect(mine.rows[0].code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it("não duplica e não muda se a trilha for renomeada", async () => {
    await asSystem(db.pool, async (q) => {
      const e = (await q("select id from enrollments where profile_id = $1 and track_id = $2", [vera, track])).rows[0].id;
      await q("update enrollments set status = 'em_andamento' where id = $1", [e]);
      await q("update tracks set name = 'Outro nome' where id = $1", [track]);
      await q("update enrollments set status = 'concluida' where id = $1", [e]);
    });
    const rows = (await asSystem(db.pool, (q) => q("select track_name from certificates where profile_id = $1", [vera]))).rows;
    expect(rows).toEqual([{ track_name: "Trilha do certificado" }]);
  });

  it("supervisor vê o da equipe; outro supervisor não; ninguém grava", async () => {
    expect((await asUser(db.pool, sup, (q) => q("select id from certificates"))).rows).toHaveLength(1);
    expect((await asUser(db.pool, outro, (q) => q("select id from certificates"))).rows).toHaveLength(0);
    await expect(asUser(db.pool, vera, (q) => q("update certificates set person_name = 'Outra' where profile_id = $1", [vera]))).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db.pool, vera, (q) => q("insert into certificates (code, profile_id, track_id, person_name, track_name, completed_at) values ('AAAA-BBBB-CCCC', $1, $2, 'x', 'y', now())", [vera, track])),
    ).rejects.toThrow(/permission denied/);
  });

  it("validação pública por código, sem login", async () => {
    const code = (await asSystem(db.pool, (q) => q("select code from certificates where profile_id = $1", [vera]))).rows[0].code as string;
    const ok = (await asUser(db.pool, null, (q) => q("select public.verify_certificate($1) v", [` ${code.toLowerCase()} `]))).rows[0].v;
    expect(ok).toMatchObject({ code, person_name: "Vera Vendedora", track_name: "Trilha do certificado" });
    const none = (await asUser(db.pool, null, (q) => q("select public.verify_certificate('0000-0000-0000') v"))).rows[0].v;
    expect(none).toBeNull();
    // Anônimo não lê a tabela.
    await expect(asUser(db.pool, null, (q) => q("select * from certificates"))).rejects.toThrow(/permission denied/);
  });

  it("carga horária da trilha, quando informada, prevalece", async () => {
    const t2 = await asSystem(db.pool, async (q) => {
      const t = (await q("insert into tracks (name, status, certificate_hours) values ('Trilha com horas', 'publicado', 12) returning id")).rows[0].id;
      const mod = (await q("insert into modules (track_id, title, position) values ($1, 'Módulo', 1) returning id", [t])).rows[0].id;
      const c = (await q("insert into contents (title, kind, body, track_id, status, estimated_minutes) values ('Aula', 'texto', 'z', $1, 'publicado', 30) returning id", [t])).rows[0].id;
      await q("insert into module_items (module_id, content_id, position, is_required) values ($1, $2, 1, true)", [mod, c]);
      await q("insert into enrollments (profile_id, track_id) values ($1, $2)", [vera, t]);
      return { t, c };
    });
    await asUser(db.pool, vera, (q) => q("select public.complete_content($1)", [t2.c]));
    const r = (await asSystem(db.pool, (q) => q("select hours from certificates where track_id = $1", [t2.t]))).rows[0];
    expect(r.hours).toBe("12.0");
  });
});
