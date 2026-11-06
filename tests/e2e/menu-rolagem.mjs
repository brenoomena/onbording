// Configurações › Menu lateral: barra de rolagem.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { entrar } from "./auth-helper.mjs";
const BASE = "http://localhost:3000";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server"], ignoreDefaultArgs: ["--hide-scrollbars"] });
const page = await (await browser.newContext({ locale: "pt-BR", viewport: { width: 1440, height: 520 } })).newPage();
page.on("pageerror", (e) => console.log("   [pageerror]", e.message.slice(0, 200)));
let ok = 0;
const step = async (name, fn) => { try { await fn(); ok++; console.log("✔", name); } catch (e) { console.log("✘", name, "\n   ", e.message.split("\n").slice(0, 3).join(" | ")); await page.screenshot({ path: `shots/rol-fail-${ok}.png` }); } };
await entrar(page, "breno@implantta.com.br"); await page.waitForURL(/painel/);
const nav = page.locator("aside nav.sidebar-scroll");
const bar = () => nav.evaluate((el) => el.offsetWidth - el.clientWidth);

await step("padrão: barra fina de 6 px no menu", async () => {
  await page.goto(`${BASE}/painel`);
  for (const g of ["Estrutura", "Administração"]) if ((await nav.getByRole("button", { name: g }).getAttribute("aria-expanded")) === "false") await nav.getByRole("button", { name: g }).click();
  assert.ok(await nav.evaluate((el) => el.scrollHeight > el.clientHeight), "menu precisa rolar");
  assert.equal(await bar(), 6);
});

await step("Configurações › Menu lateral: larga, reta e cor própria", async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/configuracoes?secao=menu`);
  await page.getByRole("heading", { name: "Barra de rolagem do menu lateral" }).waitFor();
  await page.getByText("Larga · 14 px").click();
  await page.getByText("Reta", { exact: true }).click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".sb-prev-light").evaluate((el) => el.offsetWidth - el.clientWidth), 14);
  await page.getByLabel("Código: Barra").first().fill("#ff8800");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "shots/rol-1-config.png", fullPage: true });
  await page.getByRole("button", { name: "Salvar barra de rolagem" }).click();
  await page.getByText("Barra de rolagem do menu salva e aplicada.").waitFor();
  await page.setViewportSize({ width: 1440, height: 520 });
  await page.reload();
  const css = await page.locator("style#sidebar-scrollbar").textContent();
  assert.match(css, /width:14px/);
  assert.match(css, /border-radius:0/);
  assert.match(css, /--sb-thumb:#ff8800/);
  assert.equal(await bar(), 14);
});

await step("só ao passar o mouse: a barra some fora do menu", async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/configuracoes?secao=menu`);
  await page.getByText("Só ao passar o mouse").click();
  await page.getByRole("button", { name: "Salvar barra de rolagem" }).click();
  await page.getByText("Barra de rolagem do menu salva e aplicada.").waitFor();
  await page.reload();
  assert.match(await page.locator("style#sidebar-scrollbar").textContent(), /:not\(:hover\)::-webkit-scrollbar-thumb\{background-color:transparent\}/);
});

await step("oculta: sem barra, mas o menu continua rolando", async () => {
  await page.getByText("Oculta (a rolagem continua)").click();
  await page.getByRole("button", { name: "Salvar barra de rolagem" }).click();
  await page.getByText("Barra de rolagem do menu salva e aplicada.").waitFor();
  await page.setViewportSize({ width: 1440, height: 520 });
  await page.reload();
  assert.equal(await bar(), 0);
  await nav.evaluate((el) => el.scrollTo(0, 9999));
  assert.ok(await nav.evaluate((el) => el.scrollTop > 0));
});

await step("restaurar padrão", async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/configuracoes?secao=menu`);
  await page.getByRole("button", { name: "Restaurar padrão" }).click();
  await page.getByRole("button", { name: "Salvar barra de rolagem" }).click();
  await page.getByText("Barra de rolagem de volta ao padrão.").waitFor();
  await page.setViewportSize({ width: 1440, height: 520 });
  await page.reload();
  assert.equal(await bar(), 6);
});

await step("salvar as cores do sistema não mexe na barra", async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/configuracoes?secao=menu`);
  await page.getByText("Média · 10 px").click();
  await page.getByRole("button", { name: "Salvar barra de rolagem" }).click();
  await page.getByText("Barra de rolagem do menu salva e aplicada.").waitFor();
  await page.goto(`${BASE}/configuracoes?secao=cores`);
  await page.getByRole("button", { name: /Salvar/ }).first().click();
  await page.waitForTimeout(1500);
  await page.reload();
  assert.match(await page.locator("style#sidebar-scrollbar").textContent(), /width:10px/);
});
console.log(`${ok}/6 passos ok`);
await browser.close();
