import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, asSystem, asUser, createPerson, createTestDb, type TestDb } from "./helpers";

const run = TEST_DATABASE_URL ? describe : describe.skip;

run("Checklist de integração", () => {
  let db: TestDb;
  let admin: string;
  let sup: string;
  let ti: string;
  let antigo: string;
  let tpl: string;
  let contabil: string;

  const tasksOf = async (who: string) =>
    (await asSystem(db.pool, (q) => q("select id, title, responsible_kind, responsible_id, due_date::text, done_at from onboarding_tasks where profile_id = $1 order by position", [who]))).rows;
  const inbox = async (who: string, kind: string) => (await asSystem(db.pool, (q) => q("select title, body from notifications where profile_id = $1 and kind = $2 order by created_at", [who, kind]))).rows;

  beforeAll(async () => {
    db = await createTestDb();
    admin = await createPerson(db.pool, { name: "Ana Admin", email: "ana@x.com", role: "admin" });
    sup = await createPerson(db.pool, { name: "Sérgio Supervisor", email: "sergio@x.com", role: "supervisor" });
    ti = await createPerson(db.pool, { name: "Tiago TI", email: "tiago@x.com", role: "colaborador" });
    antigo = await createPerson(db.pool, { name: "Otávio Antigo", email: "otavio@x.com", role: "colaborador", area: "Contábil", status: "ativo" });
    contabil = (await asSystem(db.pool, (q) => q("select id from areas where name = 'Contábil'"))).rows[0].id;
    tpl = (
      await asUser(db.pool, admin, (q) =>
      q("select public.save_checklist_template(null, 'Integração Contábil', null, true, $1::jsonb, $2::jsonb) id", [
        JSON.stringify([{ area_id: contabil }]),
        JSON.stringify([
          { title: "Criar e-mail corporativo", responsibleKind: "pessoa", responsibleId: ti, offsetDays: -3 },
          { title: "Entregar crachá", responsibleKind: "rh", offsetDays: 0 },
          { title: "Conversa de boas-vindas", responsibleKind: "supervisor", offsetDays: 1 },
          { title: "Ler o código de conduta", responsibleKind: "colaborador", offsetDays: 2 },
        ]),
      ]),
      )
    ).rows[0].id;
  }, 60_000);

  afterAll(async () => {
    await db?.drop();
  });

  it("só quem gerencia vê e edita modelos", async () => {
    expect((await asUser(db.pool, sup, (q) => q("select count(*)::int n from checklist_templates"))).rows[0].n).toBe(0);
    await expect(asUser(db.pool, sup, (q) => q("insert into checklist_templates (name) values ('Outro')"))).rejects.toThrow();
    await expect(asUser(db.pool, sup, (q) => q("select public.save_checklist_template($1, 'X', null, true, '[]'::jsonb, '[]'::jsonb)", [tpl]))).rejects.toThrow(/não pode/);
  });

  it("rascunho não é aplicado; ao publicar, só quem está em onboarding recebe", async () => {
    const vera = await createPerson(db.pool, { name: "Vera Nova", email: "vera@x.com", role: "colaborador", area: "Contábil", supervisorId: sup, status: "onboarding" });
    expect(await tasksOf(vera)).toHaveLength(0);
    await asUser(db.pool, admin, (q) => q("update checklist_templates set status = 'publicado' where id = $1", [tpl]));
    expect((await tasksOf(vera)).map((t) => t.title)).toEqual(["Criar e-mail corporativo", "Entregar crachá", "Conversa de boas-vindas", "Ler o código de conduta"]);
    expect(await tasksOf(antigo)).toHaveLength(0); // já ativo: não recebe
  });

  it("cadastro novo no público recebe o checklist com prazos pela admissão", async () => {
    const id = (await asSystem(db.pool, (q) => q("insert into auth.users (email) values ('caio@x.com') returning id"))).rows[0].id;
    await asSystem(db.pool, (q) =>
      q(
        `insert into profiles (id, full_name, email, role_id, area_id, supervisor_id, status, admission_date)
         values ($1, 'Caio Novo', 'caio@x.com', (select id from roles where key = 'colaborador'), $2, $3, 'onboarding', '2026-12-01')`,
        [id, contabil, sup],
      ),
    );
    const t = await tasksOf(id);
    expect(t.map((x) => x.due_date)).toEqual(["2026-11-28", "2026-12-01", "2026-12-02", "2026-12-03"]);
    expect(t[0].responsible_id).toBe(ti);
    expect(t[3].responsible_id).toBe(id);
    // Avisos de atribuição: um por responsável.
    expect((await inbox(ti, "tarefa")).map((n) => n.title)).toContain("Checklist de Caio Novo");
    expect((await inbox(sup, "tarefa")).some((n) => n.body.startsWith("1 tarefa para você"))).toBe(true);
    expect((await inbox(id, "tarefa")).map((n) => n.title)).toEqual(["Seu checklist de integração"]);
    expect((await inbox(admin, "tarefa")).length).toBeGreaterThanOrEqual(1); // RH
  });

  it("cada um vê o que deve e só o responsável (ou o RH) marca", async () => {
    const caio = (await asSystem(db.pool, (q) => q("select id from profiles where full_name = 'Caio Novo'"))).rows[0].id;
    const [email, cracha, conversa, conduta] = await tasksOf(caio);
    // TI vê só a tarefa dele; o colaborador vê o checklist todo.
    expect((await asUser(db.pool, ti, (q) => q("select title from onboarding_tasks where profile_id = $1", [caio]))).rows.map((r) => r.title)).toEqual(["Criar e-mail corporativo"]);
    expect((await asUser(db.pool, caio, (q) => q("select count(*)::int n from onboarding_tasks where profile_id = $1", [caio]))).rows[0].n).toBe(4);
    await expect(asUser(db.pool, caio, (q) => q("select public.set_task_done($1, true)", [cracha.id]))).rejects.toThrow(/responsável/);
    await expect(asUser(db.pool, ti, (q) => q("select public.set_task_done($1, true)", [conduta.id]))).rejects.toThrow(/responsável/);
    await asUser(db.pool, ti, (q) => q("select public.set_task_done($1, true, 'Criado: caio@x.com')", [email.id]));
    await asUser(db.pool, sup, (q) => q("select public.set_task_done($1, true)", [conversa.id]));
    await asUser(db.pool, caio, (q) => q("select public.set_task_done($1, true)", [conduta.id]));
    // Ninguém além do RH altera a tarefa diretamente.
    const r = await asUser(db.pool, caio, (q) => q("update onboarding_tasks set title = 'x' where id = $1 returning 1", [cracha.id]));
    expect(r.rowCount).toBe(0);
    // Tarefa do próprio colaborador dá pontos.
    expect((await asSystem(db.pool, (q) => q("select points from points_ledger where profile_id = $1 and reason = 'tarefa'", [caio]))).rows).toEqual([{ points: 5 }]);
    expect((await asSystem(db.pool, (q) => q("select completed_at from onboarding_checklists where profile_id = $1", [caio]))).rows[0].completed_at).toBeNull();
    // O RH termina: checklist concluído, pontos, medalha e avisos.
    await asUser(db.pool, admin, (q) => q("select public.set_task_done($1, true)", [cracha.id]));
    expect((await asSystem(db.pool, (q) => q("select completed_at from onboarding_checklists where profile_id = $1", [caio]))).rows[0].completed_at).not.toBeNull();
    expect((await asSystem(db.pool, (q) => q("select points from points_ledger where profile_id = $1 and reason = 'checklist'", [caio]))).rows).toEqual([{ points: 20 }]);
    expect((await asSystem(db.pool, (q) => q("select badge_key from user_badges where profile_id = $1", [caio]))).rows.map((b) => b.badge_key)).toContain("integrado");
    expect((await inbox(sup, "checklist_concluido")).map((n) => n.title)).toEqual(["Checklist concluído: Caio Novo"]);
    // Desmarcar reabre o checklist.
    await asUser(db.pool, admin, (q) => q("select public.set_task_done($1, false)", [cracha.id]));
    expect((await asSystem(db.pool, (q) => q("select completed_at from onboarding_checklists where profile_id = $1", [caio]))).rows[0].completed_at).toBeNull();
  });

  it("salvar o público de novo não aplica o modelo a todo mundo", async () => {
    const outra = await createPerson(db.pool, { name: "Olga Outra Área", email: "olga@x.com", role: "colaborador", area: "Serviços Financeiros", status: "onboarding" });
    const items = (await asSystem(db.pool, (q) => q("select title, responsible_kind as \"responsibleKind\", responsible_id as \"responsibleId\", offset_days as \"offsetDays\" from checklist_template_items where template_id = $1 order by position", [tpl]))).rows;
    await asUser(db.pool, admin, (q) => q("select public.save_checklist_template($1, 'Integração Contábil', 'v2', true, $2::jsonb, $3::jsonb)", [tpl, JSON.stringify([{ area_id: contabil }]), JSON.stringify(items)]));
    expect(await tasksOf(outra)).toHaveLength(0);
  });

  it("aplicar à mão: só RH, e uma vez por pessoa", async () => {
    await expect(asUser(db.pool, sup, (q) => q("select public.apply_checklist($1, $2)", [tpl, antigo]))).rejects.toThrow(/não pode/);
    const id = (await asUser(db.pool, admin, (q) => q("select public.apply_checklist($1, $2) id", [tpl, antigo]))).rows[0].id;
    expect(id).toBeTruthy();
    expect(await tasksOf(antigo)).toHaveLength(4);
    await expect(asUser(db.pool, admin, (q) => q("select public.apply_checklist($1, $2)", [tpl, antigo]))).rejects.toThrow(/já tem/);
  });

  it("tarefa avulsa do RH avisa o responsável", async () => {
    const [c] = (await asSystem(db.pool, (q) => q("select id from onboarding_checklists where profile_id = $1", [antigo]))).rows;
    await asUser(db.pool, admin, (q) =>
      q("insert into onboarding_tasks (checklist_id, profile_id, title, responsible_kind, responsible_id, due_date) values ($1, $2, 'Liberar VPN', 'pessoa', $3, '2026-11-20')", [c.id, antigo, ti]),
    );
    expect((await inbox(ti, "tarefa")).map((n) => n.body)).toContain("Liberar VPN · até 20/11/2026.");
  });

  it("tarefas do dia: aviso no dia e no atraso, e um e-mail por responsável", async () => {
    const caio = (await asSystem(db.pool, (q) => q("select id from profiles where full_name = 'Caio Novo'"))).rows[0].id;
    const r = (await asSystem(db.pool, (q) => q("select public.run_email_jobs('2026-12-01'::date) r"))).rows[0].r;
    expect(r.tarefas).toBeGreaterThanOrEqual(1);
    // Crachá (RH) vence em 01/12 e está aberto.
    expect((await inbox(admin, "tarefa_prazo")).map((n) => n.title)).toContain("Tarefa vence hoje");
    const mail = (await asSystem(db.pool, (q) => q("select subject, data from email_outbox where profile_id = $1 and kind = 'tarefas_dia'", [admin]))).rows;
    expect(mail).toHaveLength(1);
    expect(mail[0].data.rows.map((x: { title: string; person: string }) => `${x.title} · ${x.person}`)).toContain("Entregar crachá · Caio Novo");
    // Mesmo dia de novo: nada repete.
    await asSystem(db.pool, (q) => q("select public.run_email_jobs('2026-12-01'::date)"));
    expect((await asSystem(db.pool, (q) => q("select count(*)::int n from email_outbox where profile_id = $1 and kind = 'tarefas_dia'", [admin]))).rows[0].n).toBe(1);
    // Quem desligou não recebe e-mail (mas recebe o aviso).
    await asUser(db.pool, ti, (q) => q("insert into email_preferences (profile_id, tarefas) values ($1, false)", [ti]));
    await asSystem(db.pool, (q) => q("select public.run_email_jobs('2026-11-21'::date)"));
    expect((await asSystem(db.pool, (q) => q("select count(*)::int n from email_outbox where profile_id = $1 and kind = 'tarefas_dia'", [ti]))).rows[0].n).toBe(0);
    expect((await inbox(ti, "tarefa_prazo")).map((n) => n.title)).toContain("Tarefa atrasada");
    expect(caio).toBeTruthy();
  });

  it("supervisor que muda passa a responder pelas tarefas de supervisor", async () => {
    const novo = await createPerson(db.pool, { name: "Nina Nova Sup", email: "nina@x.com", role: "supervisor" });
    const caio = (await asSystem(db.pool, (q) => q("select id from profiles where full_name = 'Caio Novo'"))).rows[0].id;
    await asSystem(db.pool, (q) => q("update profiles set supervisor_id = $1 where id = $2", [novo, caio]));
    const conversa = (await tasksOf(caio))[2];
    await asUser(db.pool, novo, (q) => q("select public.set_task_done($1, false)", [conversa.id]));
    await expect(asUser(db.pool, sup, (q) => q("select public.set_task_done($1, true)", [conversa.id]))).rejects.toThrow(/responsável/);
  });
});
