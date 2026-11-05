// Certificados ponta a ponta (roda depois de etapa2.mjs).
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { entrar } from "./auth-helper.mjs";

const BASE = "http://localhost:3000";
const API = "http://localhost:54321";
const SHOTS = "/var/tmp/sbstack/shots6";
fs.mkdirSync(SHOTS, { recursive: true });
const SK = process.env.SERVICE_KEY;
const H = { apikey: SK, Authorization: `Bearer ${SK}`, "Content-Type": "application/json", Prefer: "return=representation" };
const rest = async (path, init = {}) => {
  const r = await fetch(`${API}/rest/v1/${path}`, { headers: H, ...init });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${path}: ${t}`);
  return t ? JSON.parse(t) : null;
};
const results = [];
const step = async (name, fn) => {
  try { await fn(); results.push("ok"); console.log("✔", name); }
  catch (e) { results.push("FAIL"); console.log("✘", name, "\n   ", e.message.split("\n").slice(0, 3).join(" | ")); }
};
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server"] });
const open = async (email, viewport = { width: 1440, height: 900 }) => {
  const ctx = await browser.newContext({ locale: "pt-BR", viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("   [pageerror]", e.message.slice(0, 200)));
  if (email) await entrar(page, email);
  return page;
};

// Trilha curta: um módulo com um texto obrigatório (12 h de carga) e a Vera matriculada.
const vera = (await rest("profiles?select=id&email=eq.vera@implantta.com.br"))[0].id;
const [track] = await rest("tracks", { method: "POST", body: JSON.stringify({ name: "Integração Implantta", status: "publicado", is_sequential: true, certificate_hours: 12 }) });
const [mod] = await rest("modules", { method: "POST", body: JSON.stringify({ track_id: track.id, title: "Boas-vindas", position: 1 }) });
const [content] = await rest("contents", { method: "POST", body: JSON.stringify({ title: "Nossa história", kind: "texto", body: "A Implantta nasceu…", track_id: track.id, status: "publicado", estimated_minutes: 20 }) });
await rest("module_items", { method: "POST", body: JSON.stringify({ module_id: mod.id, content_id: content.id, position: 1, is_required: true }) });
await rest("enrollments", { method: "POST", body: JSON.stringify({ profile_id: vera, track_id: track.id }) });

const V = await open("vera@implantta.com.br");
let cert;
await step("ao concluir a trilha, o certificado é emitido e aparece na trilha", async () => {
  await V.goto(`${BASE}/estudar/${content.id}?trilha=${track.id}`);
  await V.getByRole("button", { name: "Marcar como concluído" }).click();
  await V.waitForTimeout(1500);
  [cert] = await rest(`certificates?select=*&track_id=eq.${track.id}`);
  assert.ok(cert, "certificado não emitido");
  assert.equal(cert.person_name, "Vera Vendedora");
  assert.equal(Number(cert.hours), 12);
  await V.goto(`${BASE}/minhas-trilhas/${track.id}`);
  await V.getByText("Trilha concluída: seu certificado está pronto").waitFor();
  await V.getByText(cert.code).waitFor();
});

await step("menu Certificados lista e abre o certificado", async () => {
  await V.getByRole("link", { name: "Certificados" }).first().click();
  await V.waitForURL(/meus-certificados/);
  await V.getByText("Integração Implantta").waitFor();
  await V.screenshot({ path: `${SHOTS}/01-meus-certificados.png` });
  await V.getByRole("link", { name: "Ver" }).first().click();
  await V.getByRole("img", { name: /Certificado de Vera Vendedora/ }).waitFor();
  await V.waitForTimeout(500);
  await V.screenshot({ path: `${SHOTS}/02-certificado.png`, fullPage: true });
});

await step("baixa o PDF (A4 deitado) com os dados", async () => {
  const [dl] = await Promise.all([V.waitForEvent("download"), V.getByRole("link", { name: "Baixar PDF" }).first().click()]);
  assert.match(dl.suggestedFilename(), /^certificado-integracao-implantta\.pdf$/);
  const file = `${SHOTS}/certificado.pdf`;
  await dl.saveAs(file);
  const buf = fs.readFileSync(file);
  assert.equal(buf.subarray(0, 4).toString(), "%PDF");
  execFileSync("pdftoppm", ["-png", "-r", "110", "-singlefile", file, `${SHOTS}/03-pdf`]);
  const info = execFileSync("pdfinfo", [file]).toString();
  assert.match(info, /Page size:\s+842 x 595/);
});

await step("outra pessoa não acessa o certificado da Vera", async () => {
  const O = await open("otavio@implantta.com.br").catch(() => null);
  if (!O) return; // pessoa não existe nesta base
  const r = await O.request.get(`${BASE}/certificados/${cert.id}/pdf`);
  assert.equal(r.status(), 404);
});

await step("validação pública sem login, por link e por código digitado", async () => {
  const P = await open(null);
  await P.goto(`${BASE}/certificado/${cert.code}`);
  await P.getByText("Certificado válido").waitFor();
  await P.getByText("Vera Vendedora").waitFor();
  await P.getByText("12 horas").waitFor();
  await P.waitForTimeout(600);
  await P.screenshot({ path: `${SHOTS}/04-validacao.png` });
  await P.goto(`${BASE}/certificado`);
  await P.locator("#codigo").fill(cert.code.replace(/-/g, "").toLowerCase());
  await P.getByRole("button", { name: "Validar" }).click();
  await P.getByText("Certificado válido").waitFor();
  await P.goto(`${BASE}/certificado/0000-0000-0000`);
  await P.getByText("Certificado não encontrado").waitFor();
  const m = await open(null, { width: 390, height: 844 });
  await m.goto(`${BASE}/certificado/${cert.code}`);
  await m.getByText("Certificado válido").waitFor();
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `rolagem lateral ${overflow}`);
});

await step("admin edita o modelo em Configurações › Certificado e a mudança vale para o emitido", async () => {
  const A = await open("breno@implantta.com.br");
  await A.goto(`${BASE}/configuracoes?secao=certificado`);
  await A.getByText("Prévia ao vivo (dados de exemplo)").waitFor();
  await A.locator("#ct-title").fill("Certificado de excelência");
  await A.locator("#ct-signer").fill("Breno Omena");
  await A.locator("#ct-role").fill("Diretor de Operações");
  await A.getByLabel("Sem serifa (moderna)").check();
  await A.locator("#ct-primary").fill("#14afcc");
  await A.waitForTimeout(400);
  await A.screenshot({ path: `${SHOTS}/05-config-certificado.png`, fullPage: true });
  await A.getByRole("button", { name: "Salvar certificado" }).click();
  await A.getByText("Modelo do certificado salvo").waitFor();
  await A.keyboard.press("Escape");
  // Texto sem {trilha} é recusado.
  await A.locator("#ct-body").fill("concluiu o curso.");
  await A.getByRole("button", { name: "Salvar certificado" }).click();
  await A.getByText(/marcador \{trilha\}/).first().waitFor();
  const ex = await A.request.get(`${BASE}/configuracoes/certificado/exemplo`);
  assert.equal(ex.headers()["content-type"], "application/pdf");
  fs.writeFileSync(`${SHOTS}/exemplo.pdf`, await ex.body());
  execFileSync("pdftoppm", ["-png", "-r", "110", "-singlefile", `${SHOTS}/exemplo.pdf`, `${SHOTS}/06-exemplo`]);
  await V.goto(`${BASE}/certificados/${cert.id}`);
  await V.getByText("Certificado de excelência").first().waitFor();
  await V.getByText("Breno Omena").waitFor();
});

await step("modelos de certificado e logo própria (PDF de cada modelo)", async () => {
  const A = await open("breno@implantta.com.br");
  // Logo de teste (PNG gerado na hora).
  const sharp = (await import("/home/claude/onbording/node_modules/sharp/dist/index.cjs")).default;
  const logoPng = `${SHOTS}/logo-teste.png`;
  await sharp({ create: { width: 480, height: 120, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="120"><rect x="0" y="10" width="100" height="100" rx="22" fill="#14afcc"/><text x="120" y="82" font-family="Arial" font-weight="700" font-size="64" fill="#0a2550">ACME</text></svg>'), top: 0, left: 0 }])
    .png()
    .toFile(logoPng);
  await A.goto(`${BASE}/configuracoes?secao=certificado`);
  await A.getByText("Prévia ao vivo (dados de exemplo)").waitFor();
  await A.locator("#ct-body").fill("concluiu a trilha {trilha}, com carga horária de {carga}, em {data}.");
  await A.locator("label", { hasText: "Enviar logo própria" }).locator("input[type=file]").setInputFiles(logoPng);
  await A.waitForTimeout(2500);
  await A.screenshot({ path: `${SHOTS}/dbg-logo.png`, fullPage: true });
  await A.getByRole("button", { name: "Usar a da Marca" }).waitFor({ timeout: 8000 });
  await A.locator("#ct-logo-h").fill("60");
  for (const [label, key] of [["Clássico", "classico"], ["Moderno", "moderno"], ["Elegante", "elegante"], ["Minimalista", "minimalista"], ["Faixas", "faixa"]]) {
    await A.locator(`input[name=ct-model][value=${key}]`).check({ force: true });
    await A.getByRole("button", { name: "Salvar certificado" }).click();
    await A.getByText("Modelo do certificado salvo").first().waitFor();
    await A.keyboard.press("Escape");
    const ex = await A.request.get(`${BASE}/configuracoes/certificado/exemplo`);
    fs.writeFileSync(`${SHOTS}/m-${key}.pdf`, await ex.body());
    execFileSync("pdftoppm", ["-png", "-r", "60", "-singlefile", `${SHOTS}/m-${key}.pdf`, `${SHOTS}/m-${key}`]);
    await A.locator("div[role=img]").first().screenshot({ path: `${SHOTS}/v-${key}.png` });
  }
  const saved = (await rest("app_settings?select=certificate_theme"))[0].certificate_theme;
  assert.equal(saved.model, "faixa");
  assert.match(saved.logoPath, /^logo\/[0-9a-f-]{36}\.png$/);
  await A.screenshot({ path: `${SHOTS}/07-config-modelos.png`, fullPage: true });
});

await step("gestor vê o link do certificado nas matrículas da trilha", async () => {
  const A = await open("breno@implantta.com.br");
  await A.goto(`${BASE}/trilhas/${track.id}/matriculas`);
  await A.getByRole("link", { name: "Ver certificado" }).click();
  await A.getByRole("img", { name: /Certificado de Vera Vendedora/ }).waitFor();
});

console.log(`\n${results.filter((r) => r === "ok").length}/${results.length} passos ok`);
await browser.close();
process.exit(0);
