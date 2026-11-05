// Teste ponta a ponta da Etapa 1 contra o stack local (GoTrue + PostgREST + Postgres).
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ADMIN_HEADERS, BASE as _B, authUserId, cookieClient, entrar } from "./auth-helper.mjs";

const BASE = "http://localhost:3000";
const SHOTS = "/var/tmp/sbstack/shots";
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push(["ok", name]);
    console.log("✔", name);
  } catch (e) {
    results.push(["FAIL", name, e.message]);
    console.log("✘", name, "\n   ", e.message.split("\n")[0]);
  }
};

const qp = (s) => s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
async function lastLinkFor(email, type) {
  for (let i = 0; i < 20; i++) {
    const mails = await (await fetch("http://localhost:54321/__mails")).json();
    const m = mails.filter((x) => x.to.includes(email)).at(-1);
    const body = m ? qp(m.body) : "";
    const link = body.match(new RegExp(`href="([^"]*type=${type}[^"]*)"`))?.[1];
    if (link) return link.replace(/&amp;/g, "&");
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Sem e-mail ${type} para ${email}`);
}
const mailCount = async (email) => (await (await fetch("http://localhost:54321/__mails")).json()).filter((x) => x.to.includes(email)).length;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server"] }).catch(() =>
  chromium.launch(),
);
const newUser = async (opts = {}) => {
  const ctx = await browser.newContext({ locale: "pt-BR", viewport: { width: 1360, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("   [pageerror]", e.message));
  return { ctx, page };
};
const menu = async (page) => (await page.locator("aside nav a").allInnerTexts()).map((s) => s.trim());

// Acesso só com Google: nos testes, a sessão é colocada direto (ver auth-helper.mjs).
async function acceptInvite(page, email) {
  await entrar(page, email);
  await page.waitForURL(/\/painel/);
}
async function login(page, email) {
  await entrar(page, email);
  await page.waitForURL(/\/painel/);
}
/**
 * Volta real do login (rota /auth/callback) para uma conta qualquer: usa um
 * link mágico do Supabase no lugar do Google, que não existe no teste local.
 */
async function voltaDoLogin(page, email) {
  const { sb, cookies } = cookieClient();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${BASE}/auth/callback`, shouldCreateUser: false } });
  if (error) throw new Error(error.message);
  // O GoTrue local monta o link sem o prefixo /auth/v1 do gateway.
  const link = (await lastLinkFor(email, "magiclink")).replace("localhost:54321/verify", "localhost:54321/auth/v1/verify");
  await page.context().addCookies(cookies());
  await page.goto(link);
}
async function logout(page) {
  // Fecha uma janela de ver/editar que esteja aberta por cima do menu.
  if (await page.locator(".in-modal").count()) await page.keyboard.press("Escape");
  await page.locator(".in-modal").waitFor({ state: "detached" });
  await page.locator("header button[aria-haspopup=menu]").click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await page.waitForURL(/\/login/);
}

const PASS = "SenhaForte!2026";
const admin = await newUser();
let A = admin.page;

await step("admin entra: o acesso foi liberado pelo cadastro", async () => {
  await acceptInvite(A, "breno@implantta.com.br");
  assert.match(await A.locator("h1").innerText(), /Olá, Breno/);
});

await step("login só com Google: sem campo de senha", async () => {
  const { page } = await newUser();
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: "Entrar com Google" }).waitFor();
  assert.equal(await page.locator("input[type=password], #email").count(), 0);
  // Conta Google sem cadastro: o Supabase recusa (cadastro aberto desligado) e a tela explica.
  await page.goto(`${BASE}/auth/callback?error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed+for+this+instance`);
  await page.waitForURL(/\/login\?erro=nao-liberado/);
  await page.getByText("não tem acesso liberado").waitFor();
  await page.goto(`${BASE}/auth/callback?error=access_denied&error_description=The+user+denied+access`);
  await page.getByText("foi cancelado").waitFor();
  await page.screenshot({ path: `${SHOTS}/00-login-google.png` });
  await page.context().close();
});

await step("admin vê todos os menus", async () => {
  assert.deepEqual(await menu(A), ["Painel", "Minhas trilhas", "Materiais", "Conquistas", "Certificados", "Comunicados", "Trilhas", "Conteúdos", "Colaboradores", "Acompanhamento", "Áreas", "Cargos", "Níveis", "Perfis de acesso", "Configurações", "Auditoria"]);
  await A.screenshot({ path: `${SHOTS}/01-painel-admin.png`, fullPage: true });
});

await step("cria e exclui uma área sem vínculos; área em uso não oferece exclusão", async () => {
  await A.goto(`${BASE}/estrutura/areas`);
  await A.fill("#name-nova", "Implantação");
  await A.fill("#desc-nova", "Teste");
  await A.getByRole("button", { name: "Criar área" }).click();
  await A.getByText('Área "Implantação" criada.').waitFor();
  const row = A.locator("div.rounded-xl", { hasText: "Implantação" }).first();
  await row.getByRole("button", { name: "Excluir", exact: true }).click();
  await A.getByRole("dialog").getByRole("button", { name: "Excluir área" }).click();
  await A.waitForTimeout(800);
  await A.reload();
  assert.equal(await A.getByText("Implantação").count(), 0);
});

await step("nome de área duplicado mostra mensagem clara", async () => {
  await A.fill("#name-nova", "contábil");
  await A.getByRole("button", { name: "Criar área" }).click();
  await A.getByText("Já existe um registro com esse nome").waitFor();
});

await step("cria nível novo e reposiciona na hierarquia", async () => {
  await A.goto(`${BASE}/estrutura/niveis`);
  await A.fill("#name-novo", "Especialista");
  await A.getByRole("button", { name: "Criar nível" }).click();
  await A.getByText("criado no topo da hierarquia").waitFor();
  const names = async () => (await A.locator("ol > li p.font-semibold").allInnerTexts()).map((s) => s.trim());
  assert.deepEqual(await names(), ["Júnior", "Pleno", "Sênior", "Especialista"]);
  await A.locator("ol > li", { hasText: "Especialista" }).getByRole("button", { name: "Subir nível" }).click();
  await A.waitForTimeout(800);
  await A.reload();
  assert.deepEqual(await names(), ["Júnior", "Pleno", "Especialista", "Sênior"]);
  await A.screenshot({ path: `${SHOTS}/02-niveis.png`, fullPage: true });
});

await step("cria cargo com níveis Júnior e Pleno", async () => {
  await A.goto(`${BASE}/estrutura/cargos`);
  await A.fill("#name-novo", "Consultor Comercial");
  await A.selectOption("#area-novo", { label: "Contábil" });
  const card = A.locator("section", { hasText: "Novo cargo" });
  for (const l of ["Sênior", "Especialista"]) await card.locator("label", { hasText: l }).locator("input").uncheck();
  await A.getByRole("button", { name: "Criar cargo" }).click();
  await A.getByText('Cargo "Consultor Comercial" criado.').waitFor();
  await A.reload();
  const item = A.locator("div.rounded-xl", { hasText: "Consultor Comercial" }).first();
  const got = (await item.locator("span.rounded-full:visible").allInnerTexts()).map((s) => s.trim()); assert.deepEqual(got, ["Júnior", "Pleno"]);
  await A.screenshot({ path: `${SHOTS}/03-cargos.png`, fullPage: true });
});

await step("cadastra supervisor com perfil Supervisor e libera o acesso", async () => {
  await A.goto(`${BASE}/colaboradores/novo`);
  await A.fill("#full_name", "Sérgio Supervisor");
  await A.fill("#email", "sergio@implantta.com.br");
  await A.selectOption("#area_id", { label: "Contábil" });
  await A.selectOption("#role_id", { label: "Supervisor" });
  await A.selectOption("#status", "ativo");
  await A.getByRole("button", { name: "Cadastrar e liberar acesso" }).click();
  await A.waitForURL(/colaboradores\/[0-9a-f-]{36}\?aviso=cadastrado/);
  await A.getByText("O acesso está liberado").waitFor();
  assert.equal(await mailCount("sergio@implantta.com.br"), 0, "sem e-mail de convite");
  assert.ok(await authUserId("sergio@implantta.com.br"), "login liberado para o e-mail");
});

await step("formulário de colaborador filtra cargo pela área e nível pelo cargo", async () => {
  await A.goto(`${BASE}/colaboradores/novo`);
  await A.selectOption("#area_id", { label: "Serviços Financeiros" });
  assert.deepEqual(await A.locator("#position_id option").allInnerTexts(), ["Sem cargo"]);
  await A.selectOption("#area_id", { label: "Contábil" });
  await A.selectOption("#position_id", { label: "Consultor Comercial" });
  assert.deepEqual(await A.locator("#level_id option").allInnerTexts(), ["Sem nível", "Júnior", "Pleno"]);
  await A.screenshot({ path: `${SHOTS}/04-novo-colaborador.png`, fullPage: true });
});

await step("recusa onboarding antes da admissão sem apagar o que foi digitado", async () => {
  await A.fill("#full_name", "Carla Colaboradora");
  await A.fill("#email", "carla@implantta.com.br");
  await A.selectOption("#level_id", { label: "Júnior" });
  await A.selectOption("#supervisor_id", { label: "Sérgio Supervisor" });
  await A.fill("#admission_date", "2026-11-03");
  await A.fill("#onboarding_start_date", "2026-11-01");
  await A.getByRole("button", { name: "Cadastrar e liberar acesso" }).click();
  await A.getByText("O onboarding não pode começar antes da admissão.").first().waitFor();
  assert.equal(await A.inputValue("#full_name"), "Carla Colaboradora");
  assert.equal(await mailCount("carla@implantta.com.br"), 0);
  await A.getByRole("alertdialog").getByRole("button", { name: "OK" }).click();
});

await step("cadastra colaboradora com área, cargo, nível e supervisor", async () => {
  await A.fill("#onboarding_start_date", "2026-11-03");
  await A.getByRole("button", { name: "Cadastrar e liberar acesso" }).click();
  await A.waitForURL(/aviso=cadastrado/);
  await A.getByRole("dialog").getByRole("button", { name: "OK" }).click();
  await A.locator("dd", { hasText: "Júnior" }).waitFor();
});

await step("e-mail duplicado é recusado", async () => {
  await A.goto(`${BASE}/colaboradores/novo`);
  await A.fill("#full_name", "Carla Duplicada");
  await A.fill("#email", "CARLA@implantta.com.br");
  await A.getByRole("button", { name: "Cadastrar e liberar acesso" }).click();
  await A.getByText("Já existe um colaborador com esse e-mail.").waitFor();
});

await step("lista filtra por área e por status", async () => {
  await A.goto(`${BASE}/colaboradores`);
  assert.equal(await A.locator("tbody tr").count(), 3);
  await A.selectOption("#f-status", "onboarding");
  await A.getByRole("button", { name: "Filtrar" }).click();
  await A.waitForURL(/status=onboarding/);
  assert.deepEqual((await A.locator("tbody tr td:first-child a").allInnerTexts()), ["Carla Colaboradora"]);
  await A.goto(`${BASE}/colaboradores?q=sergio`);
  assert.deepEqual((await A.locator("tbody tr td:first-child a").allInnerTexts()), ["Sérgio Supervisor"]);
  await A.goto(`${BASE}/colaboradores`);
  await A.screenshot({ path: `${SHOTS}/05-colaboradores.png`, fullPage: true });
});

// ----------------------------------------------------------- colaboradora
const carla = await newUser();
await step("colaboradora entra e vê só o próprio painel", async () => {
  await acceptInvite(carla.page, "carla@implantta.com.br");
  assert.deepEqual(await menu(carla.page), ["Painel", "Minhas trilhas", "Materiais", "Conquistas", "Certificados", "Comunicados"]);
  await carla.page.getByText("Consultor Comercial").waitFor();
  await carla.page.getByText("Sérgio Supervisor").waitFor();
  await carla.page.screenshot({ path: `${SHOTS}/06-painel-colaboradora.png`, fullPage: true });
});

await step("colaboradora não abre páginas administrativas", async () => {
  for (const path of ["/colaboradores", "/estrutura/areas", "/perfis", "/configuracoes", "/auditoria", "/colaboradores/novo", "/trilhas", "/conteudos", "/conteudos/novo", "/trilhas/nova"]) {
    const r = await carla.page.goto(`${BASE}${path}`);
    assert.equal(r.status(), 403, path);
    await carla.page.getByText("Sem permissão para esta página").waitFor();
  }
});

await step("colaboradora troca o próprio nome", async () => {
  await carla.page.goto(`${BASE}/meu-perfil`);
  await carla.page.fill("#full_name", "Carla C. Souza");
  await carla.page.getByRole("button", { name: "Salvar nome" }).click();
  await carla.page.getByText("Nome atualizado.").waitFor();
});

// ----------------------------------------------------------- supervisor
const sergio = await newUser();
await step("supervisor entra e vê apenas a própria equipe", async () => {
  await acceptInvite(sergio.page, "sergio@implantta.com.br");
  assert.deepEqual(await menu(sergio.page), ["Painel", "Minhas trilhas", "Materiais", "Conquistas", "Certificados", "Comunicados", "Minha equipe", "Acompanhamento"]);
  await sergio.page.goto(`${BASE}/colaboradores`);
  assert.deepEqual(await sergio.page.locator("tbody tr td:first-child a").allInnerTexts(), ["Carla C. Souza"]);
  await sergio.page.screenshot({ path: `${SHOTS}/07-minha-equipe.png`, fullPage: true });
});

await step("supervisor não abre o cadastro de quem não é da equipe e não edita", async () => {
  const { data } = await fetch("http://localhost:54321/rest/v1/profiles?select=id&email=eq.breno@implantta.com.br", {
    headers: { apikey: process.env.SERVICE_KEY, Authorization: `Bearer ${process.env.SERVICE_KEY}` },
  }).then(async (r) => ({ data: await r.json() }));
  await sergio.page.goto(`${BASE}/colaboradores/${data[0].id}`);
  await sergio.page.getByText("Página não encontrada").waitFor();
  await sergio.page.goto(`${BASE}/colaboradores`);
  await sergio.page.getByRole("link", { name: "Carla C. Souza" }).click();
  await sergio.page.getByText("Dados pessoais e profissionais").first().waitFor();
  assert.equal(await sergio.page.locator("#full_name").count(), 0);
  assert.equal(await sergio.page.getByRole("link", { name: "Editar" }).count(), 0);
  const r = await sergio.page.goto(`${sergio.page.url()}/editar`);
  assert.equal(r.status(), 403);
});

// ----------------------------------------------------------- perfis e auditoria
await step("admin cria perfil personalizado e define permissões", async () => {
  await A.goto(`${BASE}/perfis`);
  await A.fill("#role-name", "Recursos Humanos");
  await A.getByRole("button", { name: "Criar perfil" }).click();
  await A.waitForURL(/perfis\/[0-9a-f-]{36}\?aviso=criado/);
  for (const t of ["Ver o painel", "Ver todos os colaboradores", "Cadastrar colaboradores", "Editar colaboradores"]) {
    await A.locator("label", { hasText: t }).locator("input").check();
  }
  await A.getByRole("button", { name: "Salvar perfil" }).click();
  await A.getByText("Perfil salvo.").waitFor();
  await A.reload();
  assert.equal(await A.locator("input[name=permissions]:checked").count(), 4);
  await A.screenshot({ path: `${SHOTS}/08-perfil.png`, fullPage: true });
});

await step("admin muda o perfil do supervisor e o menu dele muda", async () => {
  await A.goto(`${BASE}/colaboradores?q=sergio`);
  await A.getByRole("link", { name: "Sérgio Supervisor" }).click();
  await A.waitForURL(/colaboradores\/[0-9a-f-]{36}$/);
  await A.getByRole("heading", { name: "Sérgio Supervisor" }).waitFor();
  await A.getByRole("dialog").getByRole("link", { name: "Editar" }).click();
  await A.waitForURL(/editar$/);
  await A.selectOption("#role_id", { label: "Recursos Humanos" });
  await A.getByRole("button", { name: "Salvar alterações" }).click();
  await A.getByText("Alterações salvas.").waitFor();
  await sergio.page.goto(`${BASE}/painel`);
  assert.deepEqual(await menu(sergio.page), ["Painel", "Minhas trilhas", "Materiais", "Conquistas", "Certificados", "Comunicados", "Colaboradores"]);
});

await step("perfil RH cadastra só como Colaborador e não muda perfis", async () => {
  await sergio.page.goto(`${BASE}/colaboradores/novo`);
  assert.equal(await sergio.page.locator("select#role_id").count(), 0);
  assert.equal(await sergio.page.locator("input#role_id").inputValue(), "Colaborador");
});

await step("perfil RH (não administrador) não acessa perfis, configurações nem permissões individuais", async () => {
  for (const path of ["/perfis", "/configuracoes"]) {
    const r = await sergio.page.goto(`${BASE}${path}`);
    assert.equal(r.status(), 403, path);
  }
  await sergio.page.goto(`${BASE}/colaboradores?q=carla`);
  await sergio.page.getByRole("heading", { name: "Colaboradores" }).waitFor();
  await sergio.page.getByRole("link", { name: "Editar" }).first().click();
  await sergio.page.waitForURL(/editar$/);
  assert.equal(await sergio.page.getByText("Permissões por módulo e ação").count(), 0);
  assert.equal(await sergio.page.locator("select#role_id").count(), 0);
});

await step("admin não consegue desativar a si mesmo pela tela", async () => {
  await A.goto(`${BASE}/meu-perfil`);
  const { data } = await fetch("http://localhost:54321/rest/v1/profiles?select=id&email=eq.breno@implantta.com.br", {
    headers: { apikey: process.env.SERVICE_KEY, Authorization: `Bearer ${process.env.SERVICE_KEY}` },
  }).then(async (r) => ({ data: await r.json() }));
  await A.goto(`${BASE}/colaboradores/${data[0].id}`);
  assert.equal(await A.getByRole("button", { name: "Desativar", exact: true }).count(), 0);
  await A.goto(`${BASE}/colaboradores/${data[0].id}/editar`);
  assert.equal(await A.locator("#status option[value=inativo]").count(), 0);
  assert.equal(await A.locator("select#role_id").count(), 0, "não muda o próprio perfil");
  await A.getByText("Administradores têm sempre todas as permissões.").waitFor();
});

await step("desativar colaboradora bloqueia o acesso dela na hora", async () => {
  await A.goto(`${BASE}/colaboradores?q=carla`);
  await A.getByRole("link", { name: "Carla C. Souza" }).click();
  await A.getByRole("button", { name: "Desativar", exact: true }).click();
  await A.getByRole("dialog").getByRole("button", { name: "Desativar acesso" }).click();
  await A.waitForTimeout(800);
  await carla.page.goto(`${BASE}/painel`);
  assert.match(carla.page.url(), /acesso-pendente\?motivo=inativo/);
  await carla.page.getByText("Conta desativada").waitFor();
});

await step("auditoria mostra quem alterou o quê", async () => {
  await A.goto(`${BASE}/auditoria`);
  const text = await A.locator("tbody").innerText();
  assert.match(text, /Breno Administrador/);
  assert.match(text, /Carla C\. Souza · status/);
  assert.match(text, /Carla C\. Souza · nome/);
  await A.screenshot({ path: `${SHOTS}/09-auditoria.png`, fullPage: true });
});

await step("telas antigas de senha e links de convite levam ao login", async () => {
  const { page } = await newUser();
  for (const path of ["/recuperar-senha", "/definir-senha", "/auth/erro?motivo=link", "/auth/confirm?token_hash=x&type=invite&next=/definir-senha"]) {
    await page.goto(`${BASE}${path}`);
    await page.waitForURL(/\/login/);
  }
  await page.context().close();
});

await step("volta do login: conta sem cadastro é desconectada e removida", async () => {
  // Simula uma conta criada pelo Google sem cadastro na plataforma.
  const r = await fetch("http://localhost:54321/auth/v1/admin/users", { method: "POST", headers: ADMIN_HEADERS, body: JSON.stringify({ email: "intruso@implantta.com.br", email_confirm: true }) });
  assert.equal(r.status, 200);
  const { page } = await newUser();
  await voltaDoLogin(page, "intruso@implantta.com.br");
  await page.waitForURL(/\/login\?erro=nao-liberado/);
  assert.equal(await authUserId("intruso@implantta.com.br"), null, "conta sem cadastro removida");
  // Conta de outro domínio (com o domínio configurado) também não entra.
  await fetch("http://localhost:54321/auth/v1/admin/users", { method: "POST", headers: ADMIN_HEADERS, body: JSON.stringify({ email: "pessoal@gmail.com", email_confirm: true }) });
  await voltaDoLogin(page, "pessoal@gmail.com");
  await page.waitForURL(/\/login\?erro=dominio/);
  await page.goto(`${BASE}/painel`);
  await page.waitForURL(/\/login/);
  await page.context().close();
});

await step("volta do login: cadastrado entra; desativado é recusado", async () => {
  const { page } = await newUser();
  await voltaDoLogin(page, "sergio@implantta.com.br");
  await page.waitForURL(/\/painel/);
  await page.context().close();
  const p2 = (await newUser()).page;
  await voltaDoLogin(p2, "carla@implantta.com.br"); // desativada no passo anterior
  await p2.waitForURL(/\/login\?erro=inativo/);
  await p2.getByText("Seu acesso foi desativado").waitFor();
  await p2.context().close();
});

await step("telas cabem no celular sem rolagem lateral", async () => {
  const { page } = await newUser({ viewport: { width: 390, height: 844 }, storageState: await admin.ctx.storageState() });
  for (const p of ["/painel", "/colaboradores", "/colaboradores/novo", "/estrutura/cargos", "/perfis"]) {
    await page.goto(`${BASE}${p}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `${p} rola ${overflow}px para o lado`);
  }
  await page.goto(`${BASE}/colaboradores/novo`);
  await page.screenshot({ path: `${SHOTS}/10-mobile-novo.png`, fullPage: true });
  await page.goto(`${BASE}/painel`);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.screenshot({ path: `${SHOTS}/11-mobile-menu.png` });
});

await step("tema escuro", async () => {
  const { page } = await newUser({ colorScheme: "dark", storageState: await admin.ctx.storageState() });
  await page.goto(`${BASE}/colaboradores`);
  await page.screenshot({ path: `${SHOTS}/12-dark.png`, fullPage: true });
});

await browser.close();
const failed = results.filter((r) => r[0] === "FAIL");
console.log(`\n${results.length - failed.length}/${results.length} passos ok`);
process.exit(failed.length ? 1 : 0);
