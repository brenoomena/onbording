// Etiquetas: ícones e ajuste de cores (roda depois de etapa2.mjs).
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import { entrar } from "./auth-helper.mjs";

const BASE = "http://localhost:3000";
const SHOTS = "/var/tmp/sbstack/shots10";
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const step = async (name, fn) => {
  try { await fn(); results.push("ok"); console.log("✔", name); }
  catch (e) { results.push("FAIL"); console.log("✘", name, "\n   ", e.message.split("\n").slice(0, 3).join(" | ")); }
};
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server"] });
const open = async (email, viewport = { width: 1440, height: 900 }) => {
  const page = await (await browser.newContext({ locale: "pt-BR", viewport })).newPage();
  page.on("pageerror", (e) => console.log("   [pageerror]", page.url(), e.message.slice(0, 120)));
  await entrar(page, email);
  return page;
};
const A = await open("breno@implantta.com.br");
const tagColor = (p, key) => p.locator(`span[data-tag="${key}"]`).first().evaluate((el) => ({ c: getComputedStyle(el).color, b: getComputedStyle(el).backgroundColor, svg: !!el.querySelector("svg") }));

await step("tipo de material mostra ícone na etiqueta", async () => {
  await A.goto(`${BASE}/conteudos`);
  const t = await tagColor(A, "material.texto");
  assert.ok(t.svg, "sem ícone");
  assert.equal(t.c, "rgb(67, 56, 202)"); // índigo padrão
  await A.locator('span[data-tag="material.texto"]').first().screenshot({ path: `${SHOTS}/01-texto.png` });
});

await step("configurações › etiquetas lista os grupos e salva cor da paleta e cores próprias", async () => {
  await A.goto(`${BASE}/configuracoes?secao=etiquetas`);
  await A.getByText("Tipo de material", { exact: true }).waitFor();
  await A.getByText("Avaliação · por pergunta").waitFor();
  await A.screenshot({ path: `${SHOTS}/02-editor.png`, fullPage: true });
  await A.getByLabel("Cor da etiqueta Texto").selectOption("gold");
  await A.getByLabel("Cor da etiqueta Publicado").first().selectOption("custom");
  await A.getByLabel("Código: Texto · claro").first().fill("#123456");
  await A.getByLabel("Código: Fundo · claro").first().fill("#abcdef");
  await A.getByRole("button", { name: "Salvar etiquetas" }).click();
  await A.getByText(/Cores das etiquetas salvas \(2 ajustes\)/).waitFor();
  await A.keyboard.press("Escape");
  await A.goto(`${BASE}/conteudos`);
  assert.equal((await tagColor(A, "material.texto")).c, "rgb(138, 97, 0)"); // dourado
  const pub = await tagColor(A, "publicacao.publicado");
  assert.equal(pub.c, "rgb(18, 52, 86)");
  assert.equal(pub.b, "rgb(171, 205, 239)");
  await A.screenshot({ path: `${SHOTS}/03-conteudos-ajustado.png` });
});

await step("restaurar todas volta ao padrão", async () => {
  await A.goto(`${BASE}/configuracoes?secao=etiquetas`);
  await A.getByRole("button", { name: "Restaurar todas" }).click();
  await A.getByRole("button", { name: "Salvar etiquetas" }).click();
  await A.getByText("Etiquetas de volta às cores padrão.").waitFor();
  await A.goto(`${BASE}/conteudos`);
  assert.equal((await tagColor(A, "material.texto")).c, "rgb(67, 56, 202)");
});

await step("editor no celular sem rolagem lateral", async () => {
  const M = await open("breno@implantta.com.br", { width: 390, height: 844 });
  await M.goto(`${BASE}/configuracoes?secao=etiquetas`);
  const o = await M.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(o <= 1, `rola ${o}px`);
});

console.log(`\n${results.filter((r) => r === "ok").length}/${results.length} passos ok`);
await browser.close();
process.exit(0);
