// E-mails: configuração, envio de teste, tarefa diária e preferências.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import { entrar } from "./auth-helper.mjs";
const BASE = "http://localhost:3000";
const LOG = "/var/tmp/sbstack/resend.jsonl";
const sent = () => (fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server"] });
const page = await (await browser.newContext({ locale: "pt-BR", viewport: { width: 1440, height: 900 } })).newPage();
page.on("pageerror", (e) => console.log("   [pageerror]", e.message.slice(0, 200)));
let ok = 0;
const step = async (name, fn) => { try { await fn(); ok++; console.log("✔", name); } catch (e) { console.log("✘", name, "\n   ", e.message.split("\n").slice(0, 4).join(" | ")); await page.screenshot({ path: `shots/em-fail-${ok}.png`, fullPage: true }); } };
fs.rmSync(LOG, { force: true });

await step("tarefa diária exige o CRON_SECRET", async () => {
  assert.equal((await fetch(`${BASE}/api/cron/emails`)).status, 401);
  assert.equal((await fetch(`${BASE}/api/cron/emails`, { headers: { authorization: "Bearer errado" } })).status, 401);
});

await step("tarefa diária envia a fila (matrículas do cadastro inicial)", async () => {
  const r = await fetch(`${BASE}/api/cron/emails`, { headers: { authorization: "Bearer segredo-cron" } });
  const j = await r.json();
  assert.equal(r.status, 200, JSON.stringify(j));
  assert.equal(j.configured, true);
  assert.ok(j.sent >= 1, JSON.stringify(j));
  const s = sent();
  assert.ok(s.some((m) => /^Nova trilha:/.test(m.subject)), JSON.stringify(s.slice(0, 3)));
  assert.ok(s.every((m) => m.from === "Onboarding Implantta <onboarding@implantta.com.br>" && m.key.startsWith("outbox-") && m.hasCta));
  // Rodar de novo não repete nada.
  const n = s.length;
  const j2 = await (await fetch(`${BASE}/api/cron/emails`, { headers: { authorization: "Bearer segredo-cron" } })).json();
  assert.equal(j2.sent, 0);
  assert.equal(sent().length, n);
});

await entrar(page, "breno@implantta.com.br"); await page.waitForURL(/painel/);

await step("Configurações › E-mails: situação, teste e histórico", async () => {
  await page.goto(`${BASE}/configuracoes?secao=emails`);
  await page.getByRole("heading", { name: "Envio de e-mails" }).waitFor();
  await page.getByText(/^Envio ativo\./).waitFor();
  await page.screenshot({ path: "shots/em-1-config.png", fullPage: true });
  const before = sent().length;
  await page.getByRole("button", { name: "Enviar e-mail de teste para mim" }).click();
  await page.getByText("E-mail de teste enviado.", { exact: false }).waitFor();
  const last = sent().at(-1);
  assert.equal(sent().length, before + 1);
  assert.deepEqual(last.to, ["breno@implantta.com.br"]);
  assert.equal(last.subject, "E-mail de teste do Onboarding");
  await page.reload();
  await page.getByRole("cell", { name: "E-mail de teste do Onboarding" }).first().waitFor();
});

await step("desligar o resumo semanal e mudar os dias do lembrete", async () => {
  await page.getByLabel(/Resumo semanal ao gestor/).uncheck();
  await page.getByLabel("7 dias antes").check();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.getByText("Configuração de e-mails salva.").waitFor();
  await page.reload();
  assert.equal(await page.getByLabel(/Resumo semanal ao gestor/).isChecked(), false);
  assert.equal(await page.getByLabel("7 dias antes").isChecked(), true);
  assert.equal(await page.getByLabel("3 dias antes").isChecked(), true);
});

await step("Meu perfil › E-mails: desligar lembretes", async () => {
  await page.goto(`${BASE}/meu-perfil#emails`);
  await page.getByLabel(/Lembretes de prazo/).uncheck();
  await page.getByRole("button", { name: "Salvar preferências" }).click();
  await page.getByText("Preferências de e-mail salvas.").waitFor();
  await page.reload();
  assert.equal(await page.getByLabel(/Lembretes de prazo/).isChecked(), false);
  assert.equal(await page.getByLabel(/Comunicados importantes/).isChecked(), true);
  await page.screenshot({ path: "shots/em-2-perfil.png", fullPage: true });
});

await step("comunicado importante sai por e-mail logo após publicar", async () => {
  const before = sent().length;
  await page.goto(`${BASE}/comunicados/novo`);
  await page.locator("#title").fill("Mudança de horário do suporte");
  await page.locator("#body").fill("A partir de segunda o suporte atende das 8h às 18h.");
  await page.getByText("Importante", { exact: true }).first().click();
  await page.getByRole("button", { name: /Publicar/ }).first().click();
  await page.waitForTimeout(4000);
  const news = sent().slice(before);
  assert.ok(news.length >= 2, `enviados: ${news.length}`);
  assert.ok(news.every((m) => m.subject === "Mudança de horário do suporte"));
});
console.log(`${ok}/6 passos ok`);
await browser.close();
