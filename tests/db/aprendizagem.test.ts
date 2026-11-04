import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, asSystem, asUser, createPerson, createTestDb, type TestDb } from "./helpers";

const run = TEST_DATABASE_URL ? describe : describe.skip;

run("Etapa 2 · trilhas, conteúdos, matrículas e progresso", () => {
  let db: TestDb;
  let admin: string;
  let sup: string;
  let vendedor: string;
  let semArea: string;
  let outro: string;
  let track: string;

  const itemsOf = async (moduleTitle: string) =>
    (
      await asSystem(db.pool, (q) =>
        q(
          `select c.id from module_items mi join modules m on m.id = mi.module_id join contents c on c.id = mi.content_id
           where m.title = $1 order by mi.position`,
          [moduleTitle],
        ),
      )
    ).rows.map((r) => r.id as string);

  beforeAll(async () => {
    db = await createTestDb();
    admin = await createPerson(db.pool, { name: "Ana Admin", email: "ana@x.com", role: "admin" });
    sup = await createPerson(db.pool, { name: "Sérgio Supervisor", email: "sergio@x.com", role: "supervisor" });
    vendedor = await createPerson(db.pool, {
      name: "Vera Vendedora",
      email: "vera@x.com",
      role: "colaborador",
      area: "Contábil",
      supervisorId: sup,
      status: "onboarding",
    });
    outro = await createPerson(db.pool, { name: "Otávio Financeiro", email: "otavio@x.com", role: "colaborador", area: "Serviços Financeiros" });
    semArea = await createPerson(db.pool, { name: "Sílvia Sem Área", email: "silvia@x.com", role: "colaborador" });
    track = (await asSystem(db.pool, (q) => q("select id from tracks where name = 'Onboarding Comercial'"))).rows[0].id;
  }, 60_000);

  afterAll(async () => {
    await db?.drop();
  });

  it("carrega a trilha comercial com 10 itens obrigatórios e 11 materiais opcionais", async () => {
    const r = await asSystem(db.pool, (q) =>
      q(`select count(*) filter (where mi.is_required)::int req, count(*) filter (where not mi.is_required)::int opt
         from module_items mi join modules m on m.id = mi.module_id where m.track_id = $1`, [track]),
    );
    expect(r.rows[0]).toEqual({ req: 10, opt: 11 });
  });

  it("matricula automaticamente quem é das áreas do público, e só eles", async () => {
    const r = await asSystem(db.pool, (q) =>
      q(`select p.full_name, e.origin from enrollments e join profiles p on p.id = e.profile_id where e.track_id = $1 order by 1`, [track]),
    );
    expect(r.rows).toEqual([
      { full_name: "Otávio Financeiro", origin: "automatica" },
      { full_name: "Vera Vendedora", origin: "automatica" },
    ]);
  });

  it("matricula quem passa a fazer parte do público depois", async () => {
    await asUser(db.pool, admin, (q) =>
      q("update profiles set area_id = (select id from areas where name = 'Contábil') where id = $1", [semArea]),
    );
    const r = await asSystem(db.pool, (q) => q("select count(*)::int n from enrollments where profile_id = $1", [semArea]));
    expect(r.rows[0].n).toBe(1);
    // volta ao estado sem área; a matrícula fica no histórico
    await asUser(db.pool, admin, (q) => q("update profiles set area_id = null where id = $1", [semArea]));
  });

  it("colaborador vê a trilha e os conteúdos em que está matriculado, com as instruções de acesso", async () => {
    const r = await asUser(db.pool, vendedor, (q) =>
      q("select (select count(*) from tracks)::int t, (select count(*) from contents)::int c, (select access_note from contents where title like 'Ted Talk%') note"),
    );
    expect(r.rows[0].t).toBe(1);
    expect(r.rows[0].c).toBe(21);
    expect(r.rows[0].note).toMatch(/@123456TR/);
  });

  it("quem não é do público e não está matriculado não vê trilha nem conteúdos", async () => {
    await asSystem(db.pool, (q) => q("delete from enrollments where profile_id = $1", [semArea]));
    const r = await asUser(db.pool, semArea, (q) =>
      q("select (select count(*) from tracks)::int t, (select count(*) from contents)::int c"),
    );
    expect(r.rows[0]).toEqual({ t: 0, c: 0 });
  });

  it("trilha em rascunho não aparece para o colaborador", async () => {
    await asUser(db.pool, admin, (q) => q("insert into tracks (name, status) values ('Rascunho Secreto', 'rascunho')"));
    const r = await asUser(db.pool, vendedor, (q) => q("select count(*)::int n from tracks where name = 'Rascunho Secreto'"));
    expect(r.rows[0].n).toBe(0);
  });

  it("colaborador não cria trilha, conteúdo nem matrícula", async () => {
    await expect(asUser(db.pool, vendedor, (q) => q("insert into tracks (name) values ('Pirata')"))).rejects.toThrow(/row-level security/);
    await expect(
      asUser(db.pool, vendedor, (q) => q("insert into contents (title, kind, url) values ('Pirata', 'link', 'https://x.com')")),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(db.pool, vendedor, (q) => q("insert into enrollments (profile_id, track_id) values ($1, $2)", [semArea, track])),
    ).rejects.toThrow(/row-level security/);
  });

  it("colaborador não grava progresso direto na tabela", async () => {
    const [c] = await itemsOf("Técnicas de Vendas");
    await expect(
      asUser(db.pool, vendedor, (q) => q("insert into content_progress (profile_id, content_id, status) values ($1, $2, 'concluido')", [vendedor, c])),
    ).rejects.toThrow(/permission denied/);
  });

  it("trilha sequencial: não conclui um item antes dos anteriores", async () => {
    const [produto1] = await itemsOf("Produtos");
    await expect(asUser(db.pool, vendedor, (q) => q("select public.complete_content($1)", [produto1]))).rejects.toThrow(
      /etapas anteriores/,
    );
  });

  it("material opcional fica liberado mesmo com etapas obrigatórias pendentes", async () => {
    const [video] = await itemsOf("Materiais de apoio");
    const r = await asUser(db.pool, vendedor, (q) => q("select public.content_unlocked($1) ok", [video]));
    expect(r.rows[0].ok).toBe(true);
  });

  it("abrir um conteúdo inicia a trilha e registra a visita", async () => {
    const [ted] = await itemsOf("Técnicas de Vendas");
    await asUser(db.pool, vendedor, (q) => q("select public.start_learning_session($1)", [ted]));
    const r = await asSystem(db.pool, (q) =>
      q(
        `select e.status, e.started_at is not null started, cp.visits from enrollments e
         join content_progress cp on cp.profile_id = e.profile_id and cp.content_id = $2
         where e.profile_id = $1 and e.track_id = $3`,
        [vendedor, ted, track],
      ),
    );
    expect(r.rows[0]).toEqual({ status: "em_andamento", started: true, visits: 1 });
  });

  it("tempo informado pelo navegador é limitado ao tempo real decorrido", async () => {
    const [ted] = await itemsOf("Técnicas de Vendas");
    const session = await asUser(db.pool, vendedor, async (q) => (await q("select public.start_learning_session($1) id", [ted])).rows[0].id);
    await asUser(db.pool, vendedor, (q) => q("select public.ping_learning_session($1, 10000, 10000)", [session]));
    const r = await asSystem(db.pool, (q) => q("select active_seconds, session_seconds from learning_sessions where id = $1", [session]));
    expect(r.rows[0].session_seconds).toBeLessThanOrEqual(6);
    expect(r.rows[0].active_seconds).toBeLessThanOrEqual(r.rows[0].session_seconds);
    await expect(
      asUser(db.pool, outro, (q) => q("select public.ping_learning_session($1, 5, 5)", [session])),
    ).rejects.toThrow(/Sessão não encontrada/);
  });

  it("concluir todos os obrigatórios fecha a trilha em 100%, sem depender dos opcionais", async () => {
    const required = [...(await itemsOf("Técnicas de Vendas")), ...(await itemsOf("Produtos")), ...(await itemsOf("Workshops de produto"))];
    expect(required).toHaveLength(10);
    for (const [i, c] of required.entries()) {
      await asUser(db.pool, vendedor, (q) => q("select public.complete_content($1, $2)", [c, i === 0 ? "externa_declarada" : "confirmada"]));
      if (i === 4) {
        const mid = await asSystem(db.pool, (q) => q("select progress_percent::float p, status from enrollments where profile_id=$1 and track_id=$2", [vendedor, track]));
        expect(mid.rows[0]).toEqual({ p: 50, status: "em_andamento" });
      }
    }
    const r = await asSystem(db.pool, (q) =>
      q("select progress_percent::float p, status, completed_at is not null done from enrollments where profile_id=$1 and track_id=$2", [vendedor, track]),
    );
    expect(r.rows[0]).toEqual({ p: 100, status: "concluida", done: true });
  });

  it("supervisor vê o progresso da equipe e não o de outras pessoas", async () => {
    const r = await asUser(db.pool, sup, (q) =>
      q("select p.full_name from enrollments e join profiles p on p.id = e.profile_id order by 1"),
    );
    expect(r.rows.map((x) => x.full_name)).toEqual(["Vera Vendedora"]);
    const c = await asUser(db.pool, sup, (q) => q("select count(*)::int n from content_progress where profile_id = $1", [outro]));
    expect(c.rows[0].n).toBe(0);
  });

  it("colaborador não vê o progresso de colegas", async () => {
    const r = await asUser(db.pool, outro, (q) => q("select count(*)::int n from enrollments where profile_id = $1", [vendedor]));
    expect(r.rows[0].n).toBe(0);
  });

  it("biblioteca: material de apoio aparece para o público da área", async () => {
    await asSystem(db.pool, (q) => q("delete from enrollments where profile_id = $1", [outro]));
    const r = await asUser(db.pool, outro, (q) => q("select count(*)::int n from contents where is_library"));
    expect(r.rows[0].n).toBe(11);
  });

  it("inscrição própria só em trilha do seu público", async () => {
    const opt = await asUser(db.pool, admin, async (q) => {
      const t = await q("insert into tracks (name, status, is_mandatory) values ('Trilha Opcional Fiscal', 'publicado', false) returning id");
      await q("insert into audience_rules (track_id, area_id) select $1, id from areas where name = 'Contábil'", [t.rows[0].id]);
      return t.rows[0].id as string;
    });
    await expect(asUser(db.pool, outro, (q) => q("select public.enroll_me($1)", [opt]))).rejects.toThrow(/não está disponível/);
    await asUser(db.pool, vendedor, (q) => q("select public.enroll_me($1)", [opt]));
    const r = await asSystem(db.pool, (q) => q("select origin from enrollments where profile_id = $1 and track_id = $2", [vendedor, opt]));
    expect(r.rows[0].origin).toBe("propria");
  });

  it("não exclui conteúdo usado em trilha", async () => {
    const [ted] = await itemsOf("Técnicas de Vendas");
    await expect(asUser(db.pool, admin, (q) => q("delete from contents where id = $1", [ted]))).rejects.toThrow(/foreign key/);
  });

  it("reordena módulos mantendo posições únicas", async () => {
    const mods = async () =>
      (await asSystem(db.pool, (q) => q("select title from modules where track_id = $1 order by position", [track]))).rows.map((r) => r.title);
    const id = (await asSystem(db.pool, (q) => q("select id from modules where title = 'Produtos'"))).rows[0].id;
    await asUser(db.pool, admin, (q) => q("select public.move_module($1, -1)", [id]));
    expect(await mods()).toEqual(["Produtos", "Técnicas de Vendas", "Workshops de produto", "Materiais de apoio"]);
    await asUser(db.pool, admin, (q) => q("select public.move_module($1, 1)", [id]));
    expect(await mods()).toEqual(["Técnicas de Vendas", "Produtos", "Workshops de produto", "Materiais de apoio"]);
  });

  it("registra na auditoria a criação de trilhas", async () => {
    const r = await asUser(db.pool, admin, (q) =>
      q("select count(*)::int n from audit_log where table_name = 'tracks' and actor_id = $1", [admin]),
    );
    expect(r.rows[0].n).toBeGreaterThanOrEqual(2);
  });

  // ------------------------------------------------- conteúdo por trilha

  it("conteúdos existentes ficam vinculados à trilha onde já estavam", async () => {
    const r = await asSystem(db.pool, (q) =>
      q("select count(*) filter (where track_id = $1)::int dentro, count(*) filter (where track_id is null)::int sem from contents", [track]),
    );
    expect(r.rows[0]).toEqual({ dentro: 21, sem: 0 });
  });

  it("conteúdo sem trilha só pode existir como material da Biblioteca", async () => {
    await expect(
      asUser(db.pool, admin, (q) => q("insert into contents (title, kind, url) values ('Solto', 'link', 'https://x.com')")),
    ).rejects.toThrow(/contents_track_or_library/);
    await asUser(db.pool, admin, (q) =>
      q("insert into contents (title, kind, url, is_library) values ('Só biblioteca', 'link', 'https://x.com', true)"),
    );
  });

  it("trilha só aceita conteúdos que pertencem a ela, e conteúdo em uso não muda de trilha", async () => {
    const { other, mod, c } = await asUser(db.pool, admin, async (q) => {
      const o = (await q("insert into tracks (name) values ('Trilha Isolada') returning id")).rows[0].id as string;
      const m = (await q("insert into modules (track_id, title, position) values ($1, 'Único', 1) returning id", [o])).rows[0].id as string;
      const cc = (await q("insert into contents (title, kind, url, track_id) values ('Da isolada', 'link', 'https://x.com', $1) returning id", [o])).rows[0].id as string;
      return { other: o, mod: m, c: cc };
    });
    const [ted] = await itemsOf("Técnicas de Vendas");
    await expect(
      asUser(db.pool, admin, (q) => q("insert into module_items (module_id, content_id, position) values ($1, $2, 1)", [mod, ted])),
    ).rejects.toThrow(/pertence a outra trilha/);
    await asUser(db.pool, admin, (q) => q("insert into module_items (module_id, content_id, position) values ($1, $2, 1)", [mod, c]));
    await expect(
      asUser(db.pool, admin, (q) => q("update contents set track_id = $1 where id = $2", [track, c])),
    ).rejects.toThrow(/Remova-o de lá/);
    // A trilha com conteúdos vinculados não é excluída por engano
    await asUser(db.pool, admin, (q) => q("delete from module_items where content_id = $1", [c]));
    await expect(asUser(db.pool, admin, (q) => q("delete from tracks where id = $1", [other]))).rejects.toThrow(/foreign key/);
  });

  it("mover de trilha: sai dos módulos da trilha antiga e nunca fica em duas trilhas", async () => {
    const { a, b, modA, c } = await asUser(db.pool, admin, async (q) => {
      const ta = (await q("insert into tracks (name) values ('Origem') returning id")).rows[0].id as string;
      const tb = (await q("insert into tracks (name) values ('Destino') returning id")).rows[0].id as string;
      const m = (await q("insert into modules (track_id, title, position) values ($1, 'Mod origem', 1) returning id", [ta])).rows[0].id as string;
      const cc = (await q("insert into contents (title, kind, url, track_id) values ('Viajante', 'link', 'https://x.com', $1) returning id", [ta])).rows[0].id as string;
      await q("insert into module_items (module_id, content_id, position) values ($1, $2, 1)", [m, cc]);
      return { a: ta, b: tb, modA: m, c: cc };
    });
    // Sem permissão de editar conteúdos, não move
    await expect(asUser(db.pool, vendedor, (q) => q("select public.move_content_to_track($1, $2)", [c, b]))).rejects.toThrow(/permissão/);
    const moved = await asUser(db.pool, admin, (q) => q("select public.move_content_to_track($1, $2) n", [c, b]));
    expect(moved.rows[0].n).toBe(1);
    const after = await asSystem(db.pool, (q) =>
      q("select track_id, (select count(*)::int from module_items where content_id = $1) uses from contents where id = $1", [c]),
    );
    expect(after.rows[0]).toMatchObject({ track_id: b, uses: 0 });
    // Não entra mais nos módulos da trilha antiga
    await expect(
      asUser(db.pool, admin, (q) => q("insert into module_items (module_id, content_id, position) values ($1, $2, 1)", [modA, c])),
    ).rejects.toThrow(/pertence a outra trilha/);
    // Para a Biblioteca: fica sem trilha e marcado como material de consulta
    await asUser(db.pool, admin, (q) => q("select public.move_content_to_track($1, null)", [c]));
    const lib = await asSystem(db.pool, (q) => q("select track_id, is_library from contents where id = $1", [c]));
    expect(lib.rows[0]).toMatchObject({ track_id: null, is_library: true });
    // Trilha arquivada não recebe conteúdo
    await asUser(db.pool, admin, (q) => q("update tracks set status = 'arquivado' where id = $1", [a]));
    await expect(asUser(db.pool, admin, (q) => q("select public.move_content_to_track($1, $2)", [c, a]))).rejects.toThrow(/arquivada/);
    // Quem edita conteúdos mas não trilhas não tira conteúdo de módulos
    await asSystem(db.pool, (q) =>
      q("insert into role_permissions (role_id, permission_key) select id, unnest(array['conteudos.ver','conteudos.editar']) from roles where key='supervisor' on conflict do nothing"),
    );
    const [ted] = await itemsOf("Técnicas de Vendas");
    await expect(asUser(db.pool, sup, (q) => q("select public.move_content_to_track($1, $2)", [ted, b]))).rejects.toThrow(/editar trilhas/);
    await asSystem(db.pool, (q) => q("delete from role_permissions where role_id=(select id from roles where key='supervisor') and permission_key like 'conteudos.%'"));
  });

  // ------------------------------------------------- permissões por ação

  it("quem pode criar conteúdo não exclui sem a permissão de excluir", async () => {
    await asSystem(db.pool, (q) =>
      q("insert into role_permissions (role_id, permission_key) select id, unnest(array['conteudos.ver','conteudos.criar']) from roles where key='supervisor' on conflict do nothing"),
    );
    const id = await asUser(db.pool, sup, async (q) =>
      (await q("insert into contents (title, kind, url, track_id) values ('Do supervisor', 'link', 'https://x.com', $1) returning id", [track])).rows[0].id as string,
    );
    const upd = await asUser(db.pool, sup, (q) => q("update contents set title = 'Editado' where id = $1 returning id", [id]));
    expect(upd.rowCount).toBe(0);
    const del = await asUser(db.pool, sup, (q) => q("delete from contents where id = $1 returning id", [id]));
    expect(del.rowCount).toBe(0);
    await asUser(db.pool, admin, (q) => q("insert into user_permissions (profile_id, permission_key, allowed) values ($1, 'conteudos.excluir', true)", [sup]));
    const del2 = await asUser(db.pool, sup, (q) => q("delete from contents where id = $1 returning id", [id]));
    expect(del2.rowCount).toBe(1);
    await asSystem(db.pool, async (q) => {
      await q("delete from user_permissions where profile_id = $1", [sup]);
      await q("delete from role_permissions where role_id=(select id from roles where key='supervisor') and permission_key like 'conteudos.%'");
    });
  });

  it("bloqueio individual tira o acesso à gestão mesmo com o perfil permitindo", async () => {
    await asUser(db.pool, admin, (q) => q("insert into user_permissions (profile_id, permission_key, allowed) values ($1, 'equipe.ver', false)", [sup]));
    const r = await asUser(db.pool, sup, (q) => q("select count(*)::int n from enrollments where profile_id = $1", [vendedor]));
    expect(r.rows[0].n).toBe(0);
    await asUser(db.pool, admin, (q) => q("delete from user_permissions where profile_id = $1", [sup]));
    const r2 = await asUser(db.pool, sup, (q) => q("select count(*)::int n from enrollments where profile_id = $1", [vendedor]));
    expect(r2.rows[0].n).toBeGreaterThan(0);
  });

  // ------------------------------------------------- identidade visual

  it("configurações visuais: só o admin lê e altera; cores inválidas são recusadas; tema público via função", async () => {
    const sel = await asUser(db.pool, sup, (q) => q("select count(*)::int n from app_settings"));
    expect(sel.rows[0].n).toBe(0);
    const upd = await asUser(db.pool, sup, (q) => q("update app_settings set theme = '{}'::jsonb returning id"));
    expect(upd.rowCount).toBe(0);
    await asUser(db.pool, admin, (q) =>
      q(`update app_settings set theme = '{"light":{"brand":"#ff6600","sidebar-bg":"#0f172a"},"dark":{"brand":"#ffaa00"}}'::jsonb`),
    );
    await expect(
      asUser(db.pool, admin, (q) => q(`update app_settings set theme = '{"light":{"brand":"red;}body{display:none"}}'::jsonb`)),
    ).rejects.toThrow(/check constraint/);
    await expect(
      asUser(db.pool, admin, (q) => q(`update app_settings set theme = '{"light":{"position":"#000000"}}'::jsonb`)),
    ).rejects.toThrow(/check constraint/);
    // Fundo dos ícones e fundo do título são cores próprias
    const ok = await asSystem(db.pool, (q) => q(`select private.valid_theme('{"light":{"icon-bg":"#d4edfc","header-bg":"#e9eff7"}}'::jsonb) v`));
    expect(ok.rows[0].v).toBe(true);
    await expect(
      asUser(db.pool, admin, (q) => q("update app_settings set logo_path = '../../segredo.png'")),
    ).rejects.toThrow(/check constraint/);
    const b = await asUser(db.pool, null, (q) => q("select public.get_branding() b"));
    expect(b.rows[0].b.theme.light.brand).toBe("#ff6600");
    const log = await asSystem(db.pool, (q) => q("select count(*)::int n from audit_log where table_name = 'app_settings' and actor_id = $1", [admin]));
    expect(log.rows[0].n).toBe(1);
  });

  it("favicon: só PNG na pasta da marca e devolvido pela função pública", async () => {
    await asUser(db.pool, admin, (q) => q("update app_settings set favicon_path = 'logo/11111111-2222-3333-4444-555555555555.png'"));
    await expect(asUser(db.pool, admin, (q) => q("update app_settings set favicon_path = 'logo/11111111-2222-3333-4444-555555555555.svg'"))).rejects.toThrow(/check constraint/);
    await expect(asUser(db.pool, admin, (q) => q("update app_settings set favicon_path = '../x.png'"))).rejects.toThrow(/check constraint/);
    const b = await asUser(db.pool, null, (q) => q("select public.get_branding() b"));
    expect(b.rows[0].b.favicon_path).toBe("logo/11111111-2222-3333-4444-555555555555.png");
  });

  it("símbolo e tamanhos das logos: limites validados no banco e só o admin altera", async () => {
    await asUser(db.pool, admin, (q) =>
      q(`update app_settings set logo_sizes = '{"logo":{"w":175,"h":44},"symbol":{"w":36,"h":36}}'::jsonb,
         symbol_path = 'logo/11111111-2222-3333-4444-555555555555.webp'`),
    );
    for (const bad of [
      '{"logo":{"w":300,"h":44}}',
      '{"logo":{"w":175,"h":10}}',
      '{"symbol":{"w":60,"h":60}}',
      '{"symbol":{"w":20,"h":36}}',
      '{"logo":{"w":175.5,"h":44}}',
      '{"outro":{"w":100,"h":40}}',
      '{"logo":{"w":175,"h":44,"x":1}}',
    ]) {
      await expect(asUser(db.pool, admin, (q) => q("update app_settings set logo_sizes = $1::jsonb", [bad]))).rejects.toThrow(/check constraint/);
    }
    const upd = await asUser(db.pool, sup, (q) => q(`update app_settings set logo_sizes = '{}'::jsonb returning id`));
    expect(upd.rowCount).toBe(0);
    const b = await asUser(db.pool, null, (q) => q("select public.get_branding() b"));
    expect(b.rows[0].b.logo_sizes.symbol).toEqual({ w: 36, h: 36 });
    expect(b.rows[0].b.symbol_path).toMatch(/^logo\//);
  });
});
