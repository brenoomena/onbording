// Grupos do menu recolhíveis (roda depois de etapa2.mjs).
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import { entrar } from "./auth-helper.mjs";

const BASE = "http://localhost:3000";
const SHOTS = "/var/tmp/sbstack/shots9";
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const step = async (name, fn) => {
  try { await fn(); results.push("ok"); console.log("✔", name); }
  catch (e) { results.push("FAIL"); console.log("✘", name, "\n   ", e.message.split("\n").slice(0, 3).join(" | ")); }
};
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server"] });
const page = await (await browser.newContext({ locale: "pt-BR", viewport: { width: 1440, height: 900 } })).newPage();
page.on("pageerror", (e) => console.log("   [pageerror]", e.message.slice(0, 200)));
await entrar(page, "breno@implantta.com.br");
const nav = page.locator("aside nav");
const group = (name) => nav.getByRole("button", { name });

await step("ao entrar: Aprendizagem e Gestão abertos; Estrutura e Administração recolhidos", async () => {
  await page.goto(`${BASE}/painel`);
  assert.equal(await group("Aprendizagem").getAttribute("aria-expanded"), "true");
  assert.equal(await group("Gestão").getAttribute("aria-expanded"), "true");
  assert.equal(await group("Estrutura").getAttribute("aria-expanded"), "false");
  assert.equal(await group("Administração").getAttribute("aria-expanded"), "false");
  assert.equal(await nav.getByRole("link", { name: "Áreas" }).count(), 0);
  assert.equal(await nav.getByRole("link", { name: "Configurações" }).count(), 0);
  await page.locator("aside").first().screenshot({ path: `${SHOTS}/01-padrao.png` });
});

await step("aberto uma vez, continua aberto depois de recarregar", async () => {
  await group("Estrutura").click();
  await nav.getByRole("link", { name: "Áreas" }).waitFor();
  await page.reload();
  await nav.getByRole("link", { name: "Áreas" }).waitFor();
  assert.equal(await group("Estrutura").getAttribute("aria-expanded"), "true");
});

await step("recolher de novo também fica guardado; Aprendizagem também recolhe", async () => {
  await group("Estrutura").click();
  await group("Aprendizagem").click();
  await page.reload();
  assert.equal(await nav.getByRole("link", { name: "Áreas" }).count(), 0);
  assert.equal(await nav.getByRole("link", { name: "Minhas trilhas" }).count(), 0);
  await group("Aprendizagem").click();
});

await step("página atual dentro de grupo recolhido continua visível no menu", async () => {
  await page.goto(`${BASE}/configuracoes`);
  await nav.getByRole("link", { name: "Configurações" }).waitFor();
  assert.equal(await nav.getByRole("link", { name: "Auditoria" }).count(), 0);
  await page.locator("aside").first().screenshot({ path: `${SHOTS}/02-ativo-recolhido.png` });
});

await step("ranking sem administrador; admin sem posição", async () => {
  await page.goto(`${BASE}/conquistas`);
  await page.getByRole("heading", { name: "Conquistas" }).waitFor();
  assert.equal(await page.getByText("(você)").count(), 0);
});

console.log(`\n${results.filter((r) => r === "ok").length}/${results.length} passos ok`);
await browser.close();
process.exit(0);
