import { chromium } from "playwright";
import assert from "node:assert/strict";
import { entrar } from "./auth-helper.mjs";
const SK = process.env.SERVICE_KEY;
const H = { apikey: SK, Authorization: `Bearer ${SK}` };
const tr = await (await fetch("http://localhost:54321/rest/v1/tracks?select=id,name&name=eq.Onboarding%20Comercial", { headers: H })).json();
const TID = tr[0].id;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server"] });
const ctx = await browser.newContext({ locale: "pt-BR", viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text().slice(0, 200)));
let n = 0;
const step = async (name, fn) => {
  try { await fn(); n++; console.log("✔", name); } catch (e) { console.log("✘", name, "\n    ", e.message.split("\n").slice(0, 4).join("\n     ")); await page.screenshot({ path: `shots/ed-fail-${n}.png` }); }
};
const aside = page.getByRole("complementary", { name: "Partes da trilha" });
const order = async () => (await page.locator('main [aria-current="true"]').count(), await page.locator("main section ol > li a[href^='/conteudos/']:visible").allTextContents());

await entrar(page, "breno@implantta.com.br"); await page.waitForURL(/painel/);

await step("abre a trilha em página inteira, sem janela", async () => {
  await page.goto("http://localhost:3000/trilhas");
  await page.locator(`a[href="/trilhas/${TID}"]`).first().click();
  await aside.waitFor();
  assert.equal(await page.locator(".in-modal").count(), 0);
  assert.equal(await page.getByRole("dialog").count(), 0);
  await aside.getByRole("button", { name: /Visão geral/ }).waitFor();
  // Primeiro módulo aberto por padrão.
  await page.getByText(/^Módulo 1 de \d+$/).waitFor();
  assert.match(page.url(), /parte=m-/);
  await page.waitForTimeout(500);
  await page.screenshot({ path: "shots/ed-1-modulo.png", fullPage: true });
});

await step("Conteúdo neste módulo abre o painel ao lado e cria", async () => {
  await page.getByRole("button", { name: "Conteúdo neste módulo" }).filter({ visible: true }).click();
  const panel = page.getByRole("region", { name: "Novo conteúdo" });
  await panel.waitFor();
  const pb = await panel.boundingBox();
  const mb = await page.getByText(/^Módulo 1 de/).boundingBox();
  assert.ok(pb.x > mb.x + 200, "painel ao lado do módulo");
  await page.screenshot({ path: "shots/ed-2-painel.png", fullPage: true });
  await panel.locator("#title").fill("Conteúdo pelo painel");
  await panel.locator("label", { hasText: /^Texto$/ }).click();
  await panel.locator("#body").fill("Criado sem sair do módulo.");
  await panel.getByRole("button", { name: "Criar e publicar" }).click();
  await page.getByText(/publicado e incluído no módulo/).waitFor();
  await panel.waitFor({ state: "hidden" });
  await page.locator("a:visible", { hasText: "Conteúdo pelo painel" }).waitFor();
});

let before;
await step("arrastar conteúdo muda a ordem e persiste", async () => {
  await page.waitForTimeout(2800);
  before = await page.locator("ol > li:visible a[href^='/conteudos/']").allTextContents();
  assert.ok(before.length >= 2, "itens: " + before.length);
  const rows = page.locator("section ol > li[draggable=true]:visible");
  await rows.last().dragTo(rows.first());
  await page.waitForTimeout(1500);
  await page.reload();
  await aside.waitFor();
  const after = await page.locator("ol > li:visible a[href^='/conteudos/']").allTextContents();
  assert.equal(after[0], before[before.length - 1], JSON.stringify(after));
});

await step("Novo módulo cria e abre o módulo novo", async () => {
  await aside.getByRole("button", { name: "Novo módulo" }).click();
  await page.locator("#new-mod-title").fill("Módulo pelo menu");
  await page.getByRole("button", { name: "Criar módulo" }).click();
  await page.getByText('Módulo "Módulo pelo menu" criado.').waitFor();
  await page.locator('input[name="title"]:visible').first().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('input[name="title"]')].some((i) => i.offsetParent && i.value === "Módulo pelo menu"));
  await aside.getByRole("button", { name: /Módulo pelo menu/, pressed: undefined }).waitFor();
});

await step("arrastar módulo no menu muda a ordem", async () => {
  const items = aside.locator("ol > li");
  const names = await items.allTextContents();
  await items.last().dragTo(items.first());
  await page.waitForTimeout(1800);
  await page.reload(); await aside.waitFor();
  const now = await aside.locator("ol > li").allTextContents();
  assert.match(now[0], /Módulo pelo menu/, JSON.stringify(now));
  assert.notEqual(now[0], names[0]);
});

await step("avaliação no fim do módulo abre com o módulo escolhido", async () => {
  await page.getByRole("button", { name: "Avaliação no fim deste módulo" }).filter({ visible: true }).click();
  const panel = page.getByRole("region", { name: "Nova avaliação" });
  await panel.waitFor();
  assert.equal(await panel.locator('input[value="modulo"]').isChecked(), true);
  await panel.getByRole("button", { name: "Fechar painel" }).click();
  await panel.waitFor({ state: "hidden" });
});

await step("visão geral e dados", async () => {
  await aside.getByRole("button", { name: /Visão geral/ }).click();
  await page.getByRole("heading", { name: "Antes de publicar" }).waitFor();
  await page.screenshot({ path: "shots/ed-3-visao.png", fullPage: true });
  await page.getByRole("button", { name: "Abrir módulo" }).first().click();
  await page.getByText(/^Módulo 1 de/).waitFor();
  await aside.getByRole("button", { name: /Dados e público/ }).click();
  await page.getByRole("heading", { name: "Dados e público" }).waitFor();
  await page.screenshot({ path: "shots/ed-4-dados.png", fullPage: true });
  assert.match(page.url(), /parte=dados/);
  await page.reload(); await page.getByRole("heading", { name: "Dados e público" }).waitFor();
});

await step("endereço antigo ?aba=modulo abre Novo módulo", async () => {
  await page.goto(`http://localhost:3000/trilhas/${TID}?aba=modulo`);
  await page.locator("#new-mod-title").waitFor();
});

await step("celular: seletor no lugar do menu", async () => {
  const m = await (await browser.newContext({ locale: "pt-BR", viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() })).newPage();
  m.on("pageerror", (e) => console.log("[pageerror m]", e.message));
  await m.goto(`http://localhost:3000/trilhas/${TID}`);
  const sel = m.getByLabel("Você está editando");
  await sel.waitFor();
  assert.equal(await m.getByRole("complementary", { name: "Partes da trilha" }).isVisible(), false);
  const w = await m.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(w <= 391, "sem rolagem lateral: " + w);
  await m.screenshot({ path: "shots/ed-5-celular.png", fullPage: true });
  await sel.selectOption({ label: "Visão geral" });
  await m.getByRole("heading", { name: "Antes de publicar" }).waitFor();
});

console.log(`${n} passos ok`);
await browser.close();
