// Teste ponta a ponta da Etapa 2 (trilhas, conteúdos, estudo) contra o stack local.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/var/tmp/sbstack/shots2";
fs.mkdirSync(SHOTS, { recursive: true });
const SK = process.env.SERVICE_KEY;
const results = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push(["ok", name]);
    console.log("✔", name);
  } catch (e) {
    results.push(["FAIL", name]);
    console.log("✘", name, "\n   ", e.message.split("\n").slice(0, 3).join(" | "));
  }
};
const rest = async (path) =>
  (await fetch(`http://localhost:54321/rest/v1/${path}`, { headers: { apikey: SK, Authorization: `Bearer ${SK}` } })).json();
const qp = (s) => s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
async function inviteLink(email) {
  for (let i = 0; i < 30; i++) {
    const mails = await (await fetch("http://localhost:54321/__mails")).json();
    const m = mails.filter((x) => x.to.includes(email)).at(-1);
    const link = m && qp(m.body).match(/href="([^"]*type=invite[^"]*)"/)?.[1];
    if (link) return link.replace(/&amp;/g, "&");
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("sem convite para " + email);
}
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server"] });
const newUser = async (opts = {}) => {
  const ctx = await browser.newContext({ locale: "pt-BR", viewport: { width: 1360, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("   [pageerror]", page.url(), e.message.slice(0, 160)));
  return { ctx, page };
};
async function accept(page, email) {
  await page.goto(await inviteLink(email));
  await page.waitForURL(/definir-senha/);
  await page.fill("#password", "SenhaForte!2026");
  await page.fill("#confirm", "SenhaForte!2026");
  await page.click("button[type=submit]");
  await page.waitForURL(/\/painel/);
}

const admin = await newUser();
const A = admin.page;
let trackId;

await step("admin entra e vê o menu de aprendizagem", async () => {
  await accept(A, "breno@implantta.com.br");
  const menu = (await A.locator("aside nav a").allInnerTexts()).map((s) => s.trim());
  for (const m of ["Minhas trilhas", "Materiais", "Trilhas", "Conteúdos"]) assert.ok(menu.includes(m), m);
});

await step("lista de trilhas mostra a trilha comercial publicada", async () => {
  await A.goto(`${BASE}/trilhas`);
  await A.getByRole("link", { name: /Onboarding Comercial/ }).waitFor();
  const card = await A.getByRole("link", { name: /Onboarding Comercial/ }).innerText();
  assert.match(card, /Publicado/);
  assert.match(card, /4 módulos · 21 conteúdos/);
  await A.screenshot({ path: `${SHOTS}/01-trilhas.png`, fullPage: true });
});

await step("estrutura da trilha mostra módulos e itens obrigatórios/opcionais", async () => {
  await A.getByRole("link", { name: /Onboarding Comercial/ }).click();
  await A.waitForURL(/trilhas\/[0-9a-f-]{36}$/);
  trackId = A.url().split("/").pop();
  await A.locator("ol li", { hasText: "Workshop – Domínio Portal do Cliente" }).first().waitFor();
  assert.ok((await A.getByRole("button", { name: "Opcional" }).count()) >= 11);
  await A.screenshot({ path: `${SHOTS}/02-estrutura.png`, fullPage: true });
});

await step("cadastra cargo para o vendedor", async () => {
  await A.goto(`${BASE}/estrutura/cargos`);
  await A.fill("#name-novo", "Consultor Comercial");
  await A.selectOption("#area-novo", { label: "Contábil" });
  await A.getByRole("button", { name: "Criar cargo" }).click();
  await A.getByText('Cargo "Consultor Comercial" criado.').waitFor();
});

await step("convida vendedora da área Contábil", async () => {
  await A.goto(`${BASE}/colaboradores/novo`);
  await A.fill("#full_name", "Vera Vendedora");
  await A.fill("#email", "vera@implantta.com.br");
  await A.selectOption("#area_id", { label: "Contábil" });
  await A.selectOption("#position_id", { label: "Consultor Comercial" });
  await A.selectOption("#level_id", { label: "Júnior" });
  await A.getByRole("button", { name: "Cadastrar e enviar convite" }).click();
  await A.waitForURL(/aviso=convidado/);
});

await step("cria conteúdo em texto com Markdown e publica", async () => {
  await A.goto(`${BASE}/conteudos/novo`);
  await A.fill("#title", "Boas-vindas ao time comercial");
  await A.fill("#category", "Institucional");
  await A.locator("label", { hasText: /^Texto$/ }).click();
  await A.fill("#body", "## Seja bem-vindo\n\nEste é o seu **primeiro passo**.\n\n- Conheça o time\n- Leia o material de apoio\n\n> Dúvidas? Fale com o seu supervisor.");
  await A.fill("#description", "Primeiro contato com o time.\nLeia com atenção.");
  const bodyBox = A.locator("div:has(> textarea#body)");
  await bodyBox.getByRole("button", { name: "Pré-visualizar" }).click();
  await bodyBox.locator(".prose-onb h2", { hasText: "Seja bem-vindo" }).waitFor();
  await bodyBox.getByRole("button", { name: "Editar" }).click();
  // Barra de formatação: objetivo com login e senha
  await A.click("#objective");
  await A.keyboard.type("Depois de ler, acesse o portal do cliente.");
  await A.locator("div:has(> textarea#objective)").getByRole("button", { name: "Login e senha" }).click();
  await A.keyboard.type("https://portal.exemplo.com");
  const obj = await A.inputValue("#objective");
  assert.match(obj, /portal do cliente\.\n\n\*\*Acesso:\*\* https:\/\/portal\.exemplo\.com\n\*\*Login:\*\* `seu\.email@implantta\.com\.br`/);
  await A.locator("div:has(> textarea#objective)").screenshot({ path: `${SHOTS}/03b-editor-objetivo.png` });
  await A.fill("#estimated_minutes", "5");
  await A.selectOption("#status", "publicado");
  await A.getByRole("button", { name: "Criar conteúdo" }).click();
  await A.waitForURL(/conteudos\/[0-9a-f-]{36}\?aviso=criado/);
});

await step("validação: link sem endereço é recusado", async () => {
  await A.goto(`${BASE}/conteudos/novo`);
  await A.fill("#title", "Link sem endereço");
  await A.getByRole("button", { name: "Criar conteúdo" }).click();
  await A.getByText("Informe o endereço do conteúdo.").first().waitFor();
});

await step("inclui o texto em um novo módulo e coloca no início da trilha", async () => {
  await A.goto(`${BASE}/trilhas/${trackId}`);
  await A.fill("#new-mod-title", "Boas-vindas");
  await A.getByRole("button", { name: "Criar módulo" }).click();
  await A.getByText('Módulo "Boas-vindas" criado.').waitFor();
  await A.reload();
  const mod = A.locator("div.rounded-xl", { has: A.locator("p.font-semibold", { hasText: /^Boas-vindas$/ }) }).first();
  await mod.locator("select[name=content_id]").selectOption({ label: "Boas-vindas ao time comercial" });
  await mod.getByRole("button", { name: "Incluir" }).click();
  await A.getByText("Conteúdo incluído.").waitFor();
  for (let i = 0; i < 4; i++) {
    await A.reload();
    const m = A.locator("div.rounded-xl", { has: A.locator("p.font-semibold", { hasText: /^Boas-vindas$/ }) }).first();
    const up = m.getByRole("button", { name: "↑" }).first();
    if (!(await up.count())) break;
    await up.click();
    await A.waitForTimeout(700);
  }
  await A.reload();
  const first = await A.locator("p.font-mono:text-is('Módulo 1') + p").innerText();
  assert.equal(first.trim(), "Boas-vindas");
});

// ---------------------------------------------------------------- vendedora
const vera = await newUser();
const V = vera.page;

await step("vendedora foi matriculada automaticamente e vê a trilha no painel", async () => {
  await accept(V, "vera@implantta.com.br");
  await V.getByText("Minhas trilhas").first().waitFor();
  await V.getByRole("link", { name: "Onboarding Comercial" }).waitFor();
  await V.screenshot({ path: `${SHOTS}/03-painel-vendedora.png`, fullPage: true });
});

await step("trilha sequencial: só a primeira etapa está liberada", async () => {
  await V.goto(`${BASE}/minhas-trilhas/${trackId}`);
  await V.getByRole("link", { name: /Boas-vindas ao time comercial/ }).waitFor();
  assert.equal(await V.getByRole("link", { name: /Ted Talk/ }).count(), 0, "Ted Talk deveria estar bloqueado");
  await V.screenshot({ path: `${SHOTS}/04-minha-trilha.png`, fullPage: true });
});

await step("acesso direto a uma etapa bloqueada mostra aviso", async () => {
  const items = await rest(`contents?select=id&title=eq.TR%20%7C%20Honor%C3%A1rios`);
  await V.goto(`${BASE}/estudar/${items[0].id}?trilha=${trackId}`);
  await V.getByText("é liberada quando você concluir as etapas obrigatórias anteriores").waitFor();
});

await step("estuda o texto com tempo ativo registrado e conclui", async () => {
  await V.goto(`${BASE}/minhas-trilhas/${trackId}`);
  await V.getByRole("link", { name: "Começar" }).click();
  await V.waitForURL(/estudar\//);
  await V.locator(".prose-onb h2", { hasText: "Seja bem-vindo" }).waitFor();
  // Objetivo fica abaixo do conteúdo central, formatado, com login copiável
  const objetivo = V.locator('article ~ section[aria-label="Objetivo e orientações"]');
  await objetivo.waitFor();
  assert.equal(await objetivo.locator("code.copy-code").count(), 2);
  assert.ok((await V.locator(".prose-onb br").count()) >= 1, "quebra de linha na descrição");
  for (let i = 0; i < 34; i++) {
    await V.mouse.move(200 + (i % 10) * 20, 300 + (i % 5) * 10);
    await V.waitForTimeout(1000);
  }
  await V.getByRole("button", { name: "Marcar como concluído" }).click();
  await V.getByText(/Concluído em/).waitFor();
  await V.screenshot({ path: `${SHOTS}/05-estudar-texto.png`, fullPage: true });
  const id = V.url().split("/estudar/")[1].split("?")[0];
  const prog = await rest(`content_progress?select=active_seconds,session_seconds,status&content_id=eq.${id}`);
  assert.equal(prog[0].status, "concluido");
  assert.ok(prog[0].active_seconds >= 20, `tempo ativo ${prog[0].active_seconds}`);
  assert.ok(prog[0].active_seconds <= prog[0].session_seconds, "ativo <= sessão");
});

await step("link externo mostra a senha de acesso e aceita conclusão declarada", async () => {
  await V.getByRole("link", { name: "Próximo →" }).click();
  await V.getByText("@123456TR").waitFor();
  await V.getByRole("button", { name: /Já concluí no Learning Rocks/ }).click();
  await V.getByText(/Concluído em/).waitFor();
  await V.screenshot({ path: `${SHOTS}/06-link-externo.png`, fullPage: true });
});

await step("progresso da trilha avança (2 de 11 obrigatórios)", async () => {
  await V.goto(`${BASE}/minhas-trilhas/${trackId}`);
  const pct = await V.locator('[role=progressbar]').first().getAttribute("aria-valuenow");
  assert.equal(pct, "18");
});

await step("biblioteca mostra os 11 materiais de apoio por categoria", async () => {
  await V.goto(`${BASE}/materiais`);
  assert.equal(await V.locator("main ul li").count(), 11);
  await V.getByText("Catálogo Empresarial").waitFor();
  await V.screenshot({ path: `${SHOTS}/07-materiais.png`, fullPage: true });
});

await step("material abre em janela sobre a lista (sem trocar de página)", async () => {
  await V.getByRole("button", { name: /Vídeo Institucional Thomson Reuters/ }).click();
  const dlg = V.locator("dialog[open]");
  await dlg.waitFor();
  assert.match(V.url(), /\/materiais\?material=/);
  const src = await dlg.locator("iframe").getAttribute("src");
  assert.match(src, /drive\.google\.com\/file\/d\/.+\/preview/);
  await V.screenshot({ path: `${SHOTS}/08-material-janela.png` });
  const before = await dlg.locator("#material-title").textContent();
  await V.keyboard.press("ArrowRight");
  await V.waitForFunction((t) => document.querySelector("#material-title")?.textContent !== t, before);
  await V.keyboard.press("Escape");
  await V.waitForFunction(() => !location.search.includes("material="));
  assert.equal(await V.locator("dialog[open]").count(), 0);
  assert.doesNotMatch(V.url(), /material=/);
});

await step("link compartilhado abre o material direto na janela", async () => {
  await V.getByRole("button", { name: /Catálogo Empresarial/ }).click();
  const url = V.url();
  await V.goto("about:blank");
  await V.goto(url);
  await V.locator("dialog[open] #material-title", { hasText: "Catálogo Empresarial" }).waitFor();
  await V.locator("dialog[open]").getByRole("button", { name: "Fechar" }).click();
});

await step("busca filtra materiais na hora", async () => {
  await V.getByLabel("Buscar material").fill("catalogo");
  await V.waitForFunction(() => document.querySelectorAll("main ul li").length < 11);
  assert.ok((await V.locator("main ul li").count()) >= 1);
  await V.getByLabel("Buscar material").fill("");
});

await step("vendedora não abre gestão de trilhas e conteúdos", async () => {
  for (const p of ["/trilhas", "/conteudos", `/trilhas/${trackId}/matriculas`]) {
    await V.goto(BASE + p);
    assert.match(V.url(), /sem-acesso/, p);
  }
});

// ---------------------------------------------------------------- gestão do progresso
await step("admin vê matrícula com progresso e tempo ativo", async () => {
  await A.goto(`${BASE}/trilhas/${trackId}/matriculas`);
  const row = A.locator("tbody tr", { hasText: "Vera Vendedora" });
  await row.waitFor();
  assert.match(await row.innerText(), /Em andamento/);
  assert.match(await row.innerText(), /< 1 min|\d+ min/);
  await A.screenshot({ path: `${SHOTS}/08-matriculas.png`, fullPage: true });
});

await step("cadastro do colaborador mostra trilhas e estudo", async () => {
  await A.goto(`${BASE}/colaboradores?q=vera`);
  await A.getByRole("link", { name: "Vera Vendedora" }).click();
  await A.getByText("Trilhas e estudo").waitFor();
  await A.getByText("2 conteúdos concluídos").waitFor();
});

await step("painel do admin mostra indicadores de trilhas", async () => {
  await A.goto(`${BASE}/painel`);
  await A.getByText("Matrículas", { exact: true }).waitFor();
  await A.screenshot({ path: `${SHOTS}/09-painel-admin.png`, fullPage: true });
});

await step("trilha opcional aparece como disponível e a vendedora se inscreve", async () => {
  await A.goto(`${BASE}/trilhas/nova`);
  await A.fill("#name", "Negociação avançada");
  await A.getByRole("button", { name: "Adicionar público" }).click();
  await A.locator("select[name=rule_area]").selectOption({ label: "Contábil" });
  await A.getByRole("button", { name: "Criar trilha" }).click();
  await A.waitForURL(/aviso=criada/);
  await A.fill("#new-mod-title", "Módulo único");
  await A.getByRole("button", { name: "Criar módulo" }).click();
  await A.getByText('Módulo "Módulo único" criado.').waitFor();
  await A.reload();
  await A.locator("select[name=content_id]").first().selectOption({ label: "Boas-vindas ao time comercial" });
  await A.getByRole("button", { name: "Incluir" }).first().click();
  await A.getByText("Conteúdo incluído.").waitFor();
  await A.getByRole("button", { name: "Publicar" }).click();
  await A.locator("header span.rounded-full", { hasText: "Publicado" }).waitFor();
  await V.goto(`${BASE}/minhas-trilhas`);
  await V.getByText("Disponíveis para você").waitFor();
  await V.getByRole("button", { name: "Começar" }).click();
  await V.getByRole("link", { name: /Negociação avançada/ }).waitFor();
  // O texto já concluído conta para a nova trilha também.
  assert.match(await V.getByRole("link", { name: /Negociação avançada/ }).innerText(), /100%|Concluída/);
});

await step("telas novas cabem no celular", async () => {
  const { page } = await newUser({ viewport: { width: 390, height: 844 }, storageState: await vera.ctx.storageState() });
  for (const p of ["/minhas-trilhas", `/minhas-trilhas/${trackId}`, "/materiais"]) {
    await page.goto(BASE + p);
    const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(o <= 0, `${p} rola ${o}px`);
  }
  await page.goto(`${BASE}/minhas-trilhas/${trackId}`);
  await page.screenshot({ path: `${SHOTS}/10-mobile-trilha.png`, fullPage: true });
  const { page: pa } = await newUser({ viewport: { width: 390, height: 844 }, storageState: await admin.ctx.storageState() });
  for (const p of ["/trilhas", `/trilhas/${trackId}`, `/trilhas/${trackId}/matriculas`, "/conteudos", "/conteudos/novo"]) {
    await pa.goto(BASE + p);
    const o = await pa.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(o <= 0, `${p} rola ${o}px`);
  }
});

await step("tema escuro na trilha", async () => {
  const { page } = await newUser({ colorScheme: "dark", storageState: await vera.ctx.storageState() });
  await page.goto(`${BASE}/minhas-trilhas/${trackId}`);
  await page.screenshot({ path: `${SHOTS}/11-dark.png`, fullPage: true });
});

await browser.close();
const failed = results.filter((r) => r[0] === "FAIL");
console.log(`\n${results.length - failed.length}/${results.length} passos ok`);
process.exit(failed.length ? 1 : 0);
