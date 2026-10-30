import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, asSystem, asUser, createPerson, createTestDb, migrationFiles, type TestDb } from "./helpers";

const run = TEST_DATABASE_URL ? describe : describe.skip;

run("Etapa 1 · banco, permissões e RLS", () => {
  let db: TestDb;
  let admin: string;
  let admin2: string;
  let sup: string;
  let colabTime: string;
  let colabFora: string;
  let inativo: string;

  beforeAll(async () => {
    db = await createTestDb();
    admin = await createPerson(db.pool, { name: "Ana Admin", email: "ana@implantta.com.br", role: "admin" });
    sup = await createPerson(db.pool, { name: "Sérgio Supervisor", email: "sergio@implantta.com.br", role: "supervisor", area: "Contábil" });
    colabTime = await createPerson(db.pool, {
      name: "Carla Colaboradora",
      email: "carla@implantta.com.br",
      role: "colaborador",
      area: "Contábil",
      supervisorId: sup,
      status: "onboarding",
    });
    colabFora = await createPerson(db.pool, {
      name: "Diego Outra Área",
      email: "diego@implantta.com.br",
      role: "colaborador",
      area: "Serviços Financeiros",
    });
    inativo = await createPerson(db.pool, {
      name: "Ivo Inativo",
      email: "ivo@implantta.com.br",
      role: "colaborador",
      area: "Contábil",
      status: "inativo",
    });
    admin2 = await createPerson(db.pool, { name: "Beto Admin", email: "beto@implantta.com.br", role: "admin" });
  }, 60_000);

  afterAll(async () => {
    await db?.drop();
  });

  // ---------------------------------------------------------------- dados

  it("cria as áreas, níveis e perfis iniciais", async () => {
    const r = await asSystem(db.pool, (q) =>
      q(`select (select string_agg(name, ', ' order by name) from areas) as areas,
                (select string_agg(name, ', ' order by rank) from levels) as levels,
                (select string_agg(key, ', ' order by key) from roles) as roles`),
    );
    expect(r.rows[0]).toEqual({
      areas: "Contábil, Serviços Financeiros",
      levels: "Júnior, Pleno, Sênior",
      roles: "admin, colaborador, supervisor",
    });
  });

  it("os dados iniciais podem ser aplicados de novo sem duplicar", async () => {
    const seed = migrationFiles().find((f) => f.includes("dados_iniciais"))!;
    await asSystem(db.pool, (q) => q(readFileSync(seed, "utf8")));
    const r = await asSystem(db.pool, (q) =>
      q("select (select count(*) from areas)::int a, (select count(*) from levels)::int l, (select count(*) from roles)::int r"),
    );
    expect(r.rows[0]).toEqual({ a: 2, l: 3, r: 3 });
  });

  // ------------------------------------------------------ visibilidade

  it("visitante sem login não lê nada", async () => {
    await expect(asUser(db.pool, null, (q) => q("select * from profiles"))).rejects.toThrow(/permission denied/);
    await expect(asUser(db.pool, null, (q) => q("select * from areas"))).rejects.toThrow(/permission denied/);
  });

  it("colaborador vê o próprio cadastro e o do seu supervisor, e ninguém mais", async () => {
    const r = await asUser(db.pool, colabTime, (q) => q("select full_name from profiles order by full_name"));
    expect(r.rows.map((x) => x.full_name)).toEqual(["Carla Colaboradora", "Sérgio Supervisor"]);
    const semSupervisor = await asUser(db.pool, colabFora, (q) => q("select full_name from profiles"));
    expect(semSupervisor.rows.map((x) => x.full_name)).toEqual(["Diego Outra Área"]);
  });

  it("supervisor vê a si mesmo e a própria equipe, e ninguém mais", async () => {
    const r = await asUser(db.pool, sup, (q) => q("select full_name from profiles order by full_name"));
    expect(r.rows.map((x) => x.full_name)).toEqual(["Carla Colaboradora", "Sérgio Supervisor"]);
  });

  it("administrador vê todos os colaboradores", async () => {
    const r = await asUser(db.pool, admin, (q) => q("select count(*)::int n from profiles"));
    expect(r.rows[0].n).toBe(6);
  });

  it("usuário inativo não lê a estrutura nem tem permissões", async () => {
    const r = await asUser(db.pool, inativo, (q) =>
      q("select (select count(*) from areas)::int areas, (select count(*) from public.my_permissions())::int perms"),
    );
    expect(r.rows[0]).toEqual({ areas: 0, perms: 0 });
  });

  it("colaborador não lê o registro de auditoria", async () => {
    const r = await asUser(db.pool, colabTime, (q) => q("select count(*)::int n from audit_log"));
    expect(r.rows[0].n).toBe(0);
  });

  it("my_permissions devolve todas as permissões ao administrador e só as do perfil aos demais", async () => {
    const a = await asUser(db.pool, admin, (q) => q("select count(*)::int n from public.my_permissions()"));
    const s = await asUser(db.pool, sup, (q) => q("select array_agg(k order by k) ks from public.my_permissions() k"));
    expect(a.rows[0].n).toBe(10);
    expect(s.rows[0].ks).toEqual(["equipe.ver", "painel.ver"]);
  });

  // ------------------------------------------------------ escrita

  it("colaborador não cria área nem altera cadastro de outra pessoa", async () => {
    await expect(
      asUser(db.pool, colabTime, (q) => q("insert into areas (name) values ('Área Pirata')")),
    ).rejects.toThrow(/row-level security/);
    const r = await asUser(db.pool, colabTime, (q) =>
      q("update profiles set full_name = 'Hackeado' where id = $1 returning id", [colabFora]),
    );
    expect(r.rowCount).toBe(0);
  });

  it("colaborador não altera o próprio cadastro diretamente, só o nome pela função própria", async () => {
    const direto = await asUser(db.pool, colabTime, (q) =>
      q("update profiles set status = 'ativo' where id = $1 returning id", [colabTime]),
    );
    expect(direto.rowCount).toBe(0);
    await asUser(db.pool, colabTime, (q) => q("select public.update_my_profile('Carla C. Souza')"));
    const r = await asSystem(db.pool, (q) => q("select full_name, status from profiles where id = $1", [colabTime]));
    expect(r.rows[0]).toEqual({ full_name: "Carla C. Souza", status: "onboarding" });
  });

  it("supervisor não consegue se promover a administrador", async () => {
    const r = await asUser(db.pool, sup, (q) =>
      q("update profiles set role_id = (select id from roles where key='admin') where id = $1 returning id", [sup]),
    );
    expect(r.rowCount).toBe(0);
  });

  it("administrador cadastra cargo com níveis e vincula colaborador", async () => {
    await asUser(db.pool, admin, async (q) => {
      const p = await q(
        "insert into positions (name, area_id) values ('Consultor Comercial', (select id from areas where name='Contábil')) returning id",
      );
      await q(
        "insert into position_levels (position_id, level_id) select $1, id from levels where name in ('Júnior','Pleno')",
        [p.rows[0].id],
      );
      await q(
        `update profiles set position_id = $1, level_id = (select id from levels where name='Júnior') where id = $2`,
        [p.rows[0].id, colabTime],
      );
    });
    const r = await asSystem(db.pool, (q) =>
      q(
        `select pos.name cargo, l.name nivel from profiles p join positions pos on pos.id=p.position_id
         join levels l on l.id=p.level_id where p.id=$1`,
        [colabTime],
      ),
    );
    expect(r.rows[0]).toEqual({ cargo: "Consultor Comercial", nivel: "Júnior" });
  });

  it("recusa cargo de outra área e nível não vinculado ao cargo", async () => {
    await expect(
      asUser(db.pool, admin, (q) =>
        q("update profiles set position_id = (select id from positions where name='Consultor Comercial') where id = $1", [
          colabFora,
        ]),
      ),
    ).rejects.toThrow(/não pertence à área/);
    await expect(
      asUser(db.pool, admin, (q) =>
        q("update profiles set level_id = (select id from levels where name='Sênior') where id = $1", [colabTime]),
      ),
    ).rejects.toThrow(/não está disponível para este cargo/);
  });

  it("não permite excluir área ou nível em uso", async () => {
    await expect(asUser(db.pool, admin, (q) => q("delete from areas where name='Contábil'"))).rejects.toThrow(
      /foreign key/,
    );
    await expect(asUser(db.pool, admin, (q) => q("delete from levels where name='Júnior'"))).rejects.toThrow(
      /foreign key/,
    );
  });

  it("reordena níveis sem quebrar a hierarquia", async () => {
    await asUser(db.pool, admin, (q) => q("select public.move_level((select id from levels where name='Sênior'), -1)"));
    const r = await asSystem(db.pool, (q) => q("select string_agg(name, ',' order by rank) o from levels"));
    expect(r.rows[0].o).toBe("Júnior,Sênior,Pleno");
    await asUser(db.pool, admin, (q) => q("select public.move_level((select id from levels where name='Sênior'), 1)"));
  });

  it("supervisor não reordena níveis", async () => {
    await asUser(db.pool, sup, (q) => q("select public.move_level((select id from levels where name='Pleno'), -1)"));
    const r = await asSystem(db.pool, (q) => q("select string_agg(name, ',' order by rank) o from levels"));
    expect(r.rows[0].o).toBe("Júnior,Pleno,Sênior");
  });

  // ------------------------------------------------------ travas de admin

  it("administrador não pode desativar a própria conta", async () => {
    await expect(
      asUser(db.pool, admin, (q) => q("update profiles set status='inativo' where id=$1", [admin])),
    ).rejects.toThrow(/própria conta/);
  });

  it("recusa rebaixar o último administrador ativo", async () => {
    await asSystem(db.pool, (q) => q("update profiles set status='inativo' where id=$1", [admin2]));
    // Só Ana está ativa como admin. Damos a um supervisor a gestão de perfis para tentar rebaixá-la.
    await asSystem(db.pool, (q) =>
      q(
        "insert into role_permissions (role_id, permission_key) select id, k from roles, unnest(array['perfis.gerenciar','colaboradores.gerenciar','colaboradores.ver']) k where key='supervisor' on conflict do nothing",
      ),
    );
    await expect(
      asUser(db.pool, sup, (q) =>
        q("update profiles set role_id=(select id from roles where key='colaborador') where id=$1", [admin]),
      ),
    ).rejects.toThrow(/pelo menos um administrador ativo/);
    await asSystem(db.pool, async (q) => {
      await q(
        "delete from role_permissions where permission_key in ('perfis.gerenciar','colaboradores.gerenciar','colaboradores.ver') and role_id=(select id from roles where key='supervisor')",
      );
      await q("update profiles set status='ativo' where id=$1", [admin2]);
    });
  });

  it("perfil com gestão de perfis não altera as próprias permissões nem cria administradores", async () => {
    await asUser(db.pool, admin, async (q) => {
      const r = await q("insert into roles (key, name) values ('rh', 'Recursos Humanos') returning id");
      await q(
        "insert into role_permissions (role_id, permission_key) values ($1,'perfis.gerenciar'),($1,'colaboradores.gerenciar'),($1,'colaboradores.ver')",
        [r.rows[0].id],
      );
      await q("update profiles set role_id = $1 where id = $2", [r.rows[0].id, sup]);
    });
    await expect(
      asUser(db.pool, sup, (q) =>
        q("insert into role_permissions (role_id, permission_key) select id, 'auditoria.ver' from roles where key='rh'"),
      ),
    ).rejects.toThrow(/próprio perfil/);
    await expect(
      asUser(db.pool, sup, (q) =>
        q("update profiles set role_id=(select id from roles where key='admin') where id=$1", [colabTime]),
      ),
    ).rejects.toThrow(/Somente administradores/);
    await expect(
      asUser(db.pool, sup, (q) =>
        q("insert into role_permissions (role_id, permission_key) select id, 'perfis.gerenciar' from roles where key='colaborador'"),
      ),
    ).rejects.toThrow(/Somente administradores/);
  });

  it("perfis padrão não podem ser excluídos", async () => {
    await expect(asUser(db.pool, admin, (q) => q("delete from roles where key='supervisor'"))).rejects.toThrow(
      /não podem ser excluídos/,
    );
  });

  it("quem só gerencia colaboradores cadastra apenas com o perfil Colaborador", async () => {
    await asUser(db.pool, admin, async (q) => {
      const r = await q("insert into roles (key, name) values ('cadastro', 'Cadastro') returning id");
      await q("insert into role_permissions (role_id, permission_key) values ($1,'colaboradores.gerenciar')", [
        r.rows[0].id,
      ]);
      await q("update profiles set role_id=$1 where id=$2", [r.rows[0].id, colabFora]);
    });
    const novo = await asSystem(db.pool, (q) => q("insert into auth.users (email) values ('nova@x.com') returning id"));
    await expect(
      asUser(db.pool, colabFora, (q) =>
        q(
          "insert into profiles (id, full_name, email, role_id) values ($1,'Nova Pessoa','nova@x.com',(select id from roles where key='supervisor'))",
          [novo.rows[0].id],
        ),
      ),
    ).rejects.toThrow(/somente pode|só pode/);
    await asUser(db.pool, colabFora, (q) =>
      q(
        "insert into profiles (id, full_name, email, role_id) values ($1,'Nova Pessoa','nova@x.com',(select id from roles where key='colaborador'))",
        [novo.rows[0].id],
      ),
    );
  });

  // ------------------------------------------------------ auditoria

  it("registra quem fez cada alteração e ignora atualizações só de último acesso", async () => {
    const antes = await asSystem(db.pool, (q) => q("select count(*)::int n from audit_log"));
    await asUser(db.pool, colabTime, (q) => q("select public.touch_last_access()"));
    const depoisAcesso = await asSystem(db.pool, (q) => q("select count(*)::int n from audit_log"));
    expect(depoisAcesso.rows[0].n).toBe(antes.rows[0].n);

    await asUser(db.pool, admin, (q) => q("update areas set description='Atualizada' where name='Contábil'"));
    const r = await asUser(db.pool, admin, (q) =>
      q("select actor_id, action, table_name, new_data->>'description' d from audit_log order by id desc limit 1"),
    );
    expect(r.rows[0]).toEqual({ actor_id: admin, action: "update", table_name: "areas", d: "Atualizada" });
  });

  it("ninguém apaga ou edita o registro de auditoria pela aplicação", async () => {
    await expect(asUser(db.pool, admin, (q) => q("delete from audit_log"))).rejects.toThrow(/permission denied/);
    await expect(asUser(db.pool, admin, (q) => q("update audit_log set action='x'"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("o e-mail de acesso não muda por atualização comum", async () => {
    await expect(
      asUser(db.pool, admin, (q) => q("update profiles set email='outro@x.com' where id=$1", [colabTime])),
    ).rejects.toThrow(/e-mail de acesso/);
  });
});
