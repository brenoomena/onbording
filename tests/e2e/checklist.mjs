// Checklist de integração: modelo, aplicação automática, tarefas e conclusão.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { entrar } from "./auth-helper.mjs";
const BASE = "http://localhost:3000";
const SK = process.env.SERVICE_KEY;
const H = { apikey: SK, Authorization: `Bearer ${SK}` };
const rest = async (path) => (await fetch(`http://localhost:54321/rest/v1/${path}`, { headers: H })).json();
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server"] });
const A = await (await browser.newContext({ locale: "pt-BR", viewport: { width: 1440, height: 900 } })).newPage();
const V = await (await browser.newContext({ locale: "pt-BR", viewport: { width: 1280, height: 900 } })).newPage();
for (const p of [A, V]) p.on("pageerror", (e) => console.log("   [pageerror]", e.message.slice(0, 200)));
let ok = 0;
const step = async (name, fn) => { try { await fn(); ok++; console.log("✔", name); } catch (e) { console.log("✘", name, "\n   ", e.message.split("\n").slice(0, 4).join(" | ")); await A.screenshot({ path: `shots/ck-fail-${ok}.png`, fullPage: true }); await V.screenshot({ path: `shots/ck-fail-v-${ok}.png`, fullPage: true }); } };
const check = (page, title) => page.getByRole("button", { name: new RegExp(`(Marcar|Reabrir).*“${title}”`) }).first();

await entrar(A, "breno@implantta.com.br"); await A.waitForURL(/painel/);
await entrar(V, "vera@implantta.com.br"); await V.waitForURL(/painel/);

await step("RH cria o modelo com público e três tarefas e publica", async () => {
  await A.goto(`${BASE}/checklists`);
  await A.getByRole("link", { name: /Novo modelo/ }).first().click();
  await A.locator("#name").fill("Integração Comercial");
  await A.getByRole("button", { name: /Adicionar regra|Adicionar público|regra/i }).first().click();
  await A.getByLabel("Área").first().selectOption({ label: "Contábil" });
  await A.locator("#it-t-0").fill("Criar e-mail corporativo");
  await A.locator("#it-k-0").selectOption("pessoa");
  await A.getByLabel("Pessoa responsável pela tarefa 1").selectOption({ label: "Breno Administrador" });
  await A.locator("#it-o-0").selectOption("-3");
  await A.getByRole("button", { name: "Nova tarefa" }).click();
  await A.locator("#it-t-1").fill("Entregar crachá");
  await A.getByRole("button", { name: "Nova tarefa" }).click();
  await A.locator("#it-t-2").fill("Ler o código de conduta");
  await A.locator("#it-k-2").selectOption("colaborador");
  await A.locator("#it-o-2").selectOption("1");
  await A.screenshot({ path: "shots/ck-1-editor.png", fullPage: true });
  await A.getByRole("button", { name: "Salvar e publicar" }).click();
  await A.waitForURL(/aviso=publicado/);
  await A.getByRole("link", { name: "Vera Vendedora" }).waitFor();
});

await step("RH vê as tarefas com ele e marca o crachá", async () => {
  await A.goto(`${BASE}/tarefas`);
  await check(A, "Criar e-mail corporativo").waitFor();
  await check(A, "Entregar crachá").click();
  await A.waitForTimeout(1500);
  await A.reload();
  await A.getByText(/Feitas nos últimos 30 dias/).click();
  assert.equal(await check(A, "Entregar crachá").getAttribute("aria-pressed"), "true");
  await A.screenshot({ path: "shots/ck-2-tarefas.png", fullPage: true });
});

await step("colaborador vê o próprio checklist e marca só a dele", async () => {
  await V.goto(`${BASE}/tarefas`);
  await V.getByRole("heading", { name: "Seu checklist de integração" }).waitFor();
  assert.equal(await V.getByRole("img", { name: "Pendente (outra pessoa marca)" }).count(), 1);
  await check(V, "Ler o código de conduta").click();
  await V.waitForTimeout(1500);
  await V.reload();
  await V.getByText("2 de 3 tarefas feitas", { exact: false }).waitFor();
  await V.screenshot({ path: "shots/ck-3-colaborador.png", fullPage: true });
});

await step("última tarefa conclui o checklist: pontos e medalha", async () => {
  await A.goto(`${BASE}/tarefas`);
  await check(A, "Criar e-mail corporativo").click();
  await A.waitForTimeout(2000);
  const [c] = await rest("onboarding_checklists?select=completed_at,profile_id&name=eq.Integra%C3%A7%C3%A3o%20Comercial");
  assert.ok(c.completed_at, "concluído");
  const badges = await rest(`user_badges?select=badge_key&profile_id=eq.${c.profile_id}`);
  assert.ok(badges.some((b) => b.badge_key === "integrado"));
  const pts = await rest(`points_ledger?select=reason,points&profile_id=eq.${c.profile_id}&reason=in.(tarefa,checklist)`);
  assert.deepEqual(pts.map((p) => p.points).sort(), [20, 5]);
});

await step("cadastro da pessoa: checklist e tarefa avulsa", async () => {
  const [vera] = await rest("profiles?select=id&email=eq.vera@implantta.com.br");
  await A.goto(`${BASE}/colaboradores/${vera.id}`);
  await A.getByRole("heading", { name: "Checklist de integração" }).waitFor();
  await A.getByText("3 de 3 feitas", { exact: false }).waitFor();
  await A.getByText("Incluir tarefa neste checklist").click();
  await A.getByLabel("Tarefa", { exact: true }).fill("Liberar VPN");
  await A.getByRole("button", { name: "Incluir tarefa" }).click();
  await A.getByText("Tarefa incluída.", { exact: false }).waitFor();
  await A.goto(`${BASE}/colaboradores/${vera.id}`);
  await check(A, "Liberar VPN").waitFor();
  await A.getByText("3 de 4 feitas", { exact: false }).waitFor();
  await A.screenshot({ path: "shots/ck-4-cadastro.png", fullPage: true });
});

await step("painel mostra as tarefas com a pessoa", async () => {
  await A.goto(`${BASE}/painel`);
  await A.getByRole("heading", { name: "Tarefas de integração" }).waitFor();
  await A.getByText("Liberar VPN").first().waitFor();
});

await step("tarefa diária inclui as tarefas", async () => {
  const j = await (await fetch(`${BASE}/api/cron/emails`, { headers: { authorization: "Bearer segredo-cron" } })).json();
  assert.ok("tarefas" in j.jobs, JSON.stringify(j));
});

await step("quem não gerencia não abre os modelos", async () => {
  await V.goto(`${BASE}/checklists`);
  assert.ok(!(await V.getByRole("heading", { name: "Checklists de integração" }).count()));
});
console.log(`${ok}/8 passos ok`);
await browser.close();
