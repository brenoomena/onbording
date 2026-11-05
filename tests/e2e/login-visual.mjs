import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import { entrar } from "./auth-helper.mjs";
const BASE = "http://localhost:3000";
const SHOTS = "/var/tmp/sbstack/shots5";
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const step = async (name, fn) => {
  try { await fn(); results.push("ok"); console.log("✔", name); }
  catch (e) { results.push("FAIL"); console.log("✘", name, "\n   ", e.message.split("\n").slice(0, 3).join(" | ")); }
};
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server"] });
const newPage = async (viewport = { width: 1440, height: 900 }) => {
  const p = await (await browser.newContext({ locale: "pt-BR", viewport })).newPage();
  p.on("pageerror", (e) => console.log("   [pageerror]", e.message.slice(0, 200)));
  return p;
};

await step("login novo: degradê, chamada, cartão e animação rodando", async () => {
  const p = await newPage();
  await p.goto(`${BASE}/login`);
  await p.getByText("Seu onboarding começa aqui").waitFor();
  await p.getByRole("heading", { name: "Entrar na plataforma" }).waitFor();
  const bg = await p.evaluate(() => getComputedStyle(document.querySelector("main").parentElement).backgroundImage);
  assert.match(bg, /rgb\(20, 175, 204\)/);
  assert.equal(await p.locator("canvas").count(), 1);
  // A animação muda os pixels entre dois quadros.
  const a = await p.locator("canvas").screenshot();
  await p.waitForTimeout(400);
  const b = await p.locator("canvas").screenshot();
  assert.ok(!a.equals(b), "o canvas deveria estar animando");
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${SHOTS}/01-login.png` });
  await p.goto(`${BASE}/login?erro=nao_cadastrado`);
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${SHOTS}/01b-login-erro.png` });
});

await step("login no celular sem rolagem lateral", async () => {
  const p = await newPage({ width: 390, height: 844 });
  await p.goto(`${BASE}/login`);
  await p.waitForTimeout(1000);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `rolagem lateral ${overflow}`);
  await p.screenshot({ path: `${SHOTS}/02-login-celular.png` });
});

const A = await newPage();
await entrar(A, "breno@implantta.com.br");
await step("configurações tem menu lateral com 3 seções", async () => {
  await A.goto(`${BASE}/configuracoes`);
  const nav = A.getByRole("navigation", { name: "Seções das configurações" });
  for (const s of ["Marca", "Cores do sistema", "Página de login"]) await nav.getByText(s, { exact: true }).waitFor();
  await A.getByText("Logomarca e símbolo").first().waitFor();
  await A.screenshot({ path: `${SHOTS}/03-config-marca.png` });
  await nav.getByText("Cores do sistema", { exact: true }).click();
  await A.waitForURL(/secao=cores/);
  await A.getByRole("button", { name: "Salvar cores" }).waitFor();
});

await step("edita a página de login com prévia ao vivo e salva", async () => {
  await A.goto(`${BASE}/configuracoes?secao=login`);
  await A.getByText("Prévia ao vivo").waitFor();
  await A.waitForTimeout(800);
  await A.screenshot({ path: `${SHOTS}/04-config-login.png`, fullPage: true });
  await A.getByRole("button", { name: "Noite" }).click();
  await A.getByLabel("Constelação (pontos ligados)").check();
  await A.getByLabel("Escuro", { exact: true }).check();
  await A.locator("#lg-headline").fill("Bem-vindo ao time");
  await A.getByRole("tab", { name: "Celular" }).click();
  const preview = A.locator("div.h-\\[640px\\]");
  await preview.getByText("Bem-vindo ao time").waitFor();
  await A.waitForTimeout(800);
  await A.screenshot({ path: `${SHOTS}/05-config-login-editado.png`, fullPage: true });
  await A.getByRole("button", { name: "Salvar página de login" }).click();
  await A.getByText("Página de login salva").waitFor();
  const p = await newPage();
  await p.goto(`${BASE}/login`);
  await p.getByText("Bem-vindo ao time").waitFor();
  const bg = await p.evaluate(() => getComputedStyle(document.querySelector("main").parentElement).backgroundImage);
  assert.match(bg, /rgb\(31, 59, 115\)/);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${SHOTS}/06-login-noite.png` });
});

await step("novos efeitos, área do efeito e fonte/tamanho dos textos", async () => {
  await A.goto(`${BASE}/configuracoes?secao=login`);
  await A.getByText("Prévia ao vivo").waitFor();
  const preview = A.locator("div.h-\\[640px\\]");
  for (const [label, file] of [["Linhas passando (diagonal)", "fluxo"], ["Ondas", "ondas"], ["Luzes flutuantes", "bokeh"], ["Aurora (brilhos suaves)", "aurora"]]) {
    await A.getByLabel(label).check();
    await A.waitForTimeout(1500);
    await preview.screenshot({ path: `${SHOTS}/08-efeito-${file}.png` });
  }
  await A.getByLabel("Ondas").check();
  await A.getByText("Só o lado direito").click();
  await A.locator("#lg-headline-font").selectOption("poppins");
  await A.locator("#lg-headline-size").fill("44");
  await A.locator("#lg-title-font").selectOption("playfair");
  await A.locator("#lg-subtitle-size").fill("15");
  await A.waitForTimeout(1200);
  await A.screenshot({ path: `${SHOTS}/09-editor-textos.png`, fullPage: true });
  await A.getByRole("button", { name: "Salvar página de login" }).click();
  await A.getByText("Página de login salva").first().waitFor();
  const p = await newPage();
  await p.goto(`${BASE}/login`);
  const head = p.getByText("Bem-vindo ao time");
  await head.waitFor();
  const st = await head.evaluate((el) => ({ f: getComputedStyle(el).fontFamily, s: getComputedStyle(el).fontSize }));
  assert.match(st.f, /Poppins/);
  assert.equal(st.s, "44px");
  const tf = await p.getByRole("heading", { name: "Entrar na plataforma" }).evaluate((el) => getComputedStyle(el).fontFamily);
  assert.match(tf, /Playfair/);
  const mask = await p.locator("canvas").evaluate((el) => el.style.maskImage || el.style.webkitMaskImage);
  assert.match(mask, /to left/);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${SHOTS}/10-login-ondas-direita.png` });
  const m = await newPage({ width: 390, height: 844 });
  await m.goto(`${BASE}/login`);
  await m.waitForTimeout(1000);
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `rolagem lateral ${overflow}`);
  await m.screenshot({ path: `${SHOTS}/11-celular-44px.png` });
});

await step("restaurar padrão volta ao degradê #14afcc", async () => {
  await A.getByRole("button", { name: "Restaurar padrão" }).click();
  await A.getByRole("button", { name: "Salvar página de login" }).click();
  await A.getByText("Página de login salva").first().waitFor();
  const p = await newPage();
  await p.goto(`${BASE}/login`);
  await p.getByText("Seu onboarding começa aqui").waitFor();
});

await step("tela sem permissão usa o mesmo visual", async () => {
  const p = A;
  await p.goto(`${BASE}/sem-acesso`);
  await p.getByText("Sem permissão para esta página").waitFor();
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${SHOTS}/07-sem-acesso.png` });
});

console.log(`\n${results.filter((r) => r === "ok").length}/${results.length} passos ok`);
await browser.close();
process.exit(0);
