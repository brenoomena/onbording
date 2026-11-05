// Comunicação ponta a ponta (roda depois de etapa2.mjs).
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import { entrar } from "./auth-helper.mjs";

const BASE = "http://localhost:3000";
const API = "http://localhost:54321";
const SHOTS = "/var/tmp/sbstack/shots7";
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
  catch (e) { results.push("FAIL"); try { await A.screenshot({ path: `${SHOTS}/fail-${results.length}.png` }); console.log("   url", A.url()); } catch {} console.log("✘", name, "\n   ", e.message.split("\n").slice(0, 3).join(" | ")); }
};
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server"] });
const open = async (email, viewport = { width: 1440, height: 900 }) => {
  const page = await (await browser.newContext({ locale: "pt-BR", viewport })).newPage();
  page.on("pageerror", (e) => console.log("   [pageerror]", e.message.slice(0, 200)));
  await entrar(page, email);
  return page;
};
const bell = (p) => p.getByRole("button", { name: /^Avisos/ });

const A = await open("breno@implantta.com.br");
const V = await open("vera@implantta.com.br");
let annId;

await step("vera já tem o aviso da matrícula no sininho", async () => {
  await V.goto(`${BASE}/painel`);
  await bell(V).filter({ hasText: /\d/ }).waitFor();
  await bell(V).click();
  await V.getByRole("dialog", { name: "Avisos" }).getByText(/^Nova trilha:/).first().waitFor();
  await V.screenshot({ path: `${SHOTS}/01-sininho.png` });
  await V.keyboard.press("Escape");
});

await step("admin cria comunicado importante para a área Contábil e publica", async () => {
  await A.goto(`${BASE}/comunicados`);
  await A.getByRole("link", { name: "Novo comunicado" }).click();
  await A.fill("#title", "Treinamento presencial na sexta");
  await A.fill("#body", "Na **sexta, às 9h**, teremos treinamento no auditório.\n\n- Leve o notebook\n- Confirme presença com o gestor");
  await A.getByText("Importante", { exact: true }).click();
  await A.getByRole("button", { name: /Adicionar/ }).first().click();
  await A.locator("select[name=rule_area]").first().selectOption({ label: "Contábil" });
  await A.screenshot({ path: `${SHOTS}/02-novo-comunicado.png`, fullPage: true });
  await A.getByRole("button", { name: "Publicar e enviar" }).click();
  await A.waitForURL(/aviso=publicado/);
  await A.getByText(/enviado para 1 pessoa/).first().waitFor();
  annId = A.url().match(/comunicados\/([0-9a-f-]{36})/)[1];
  await A.screenshot({ path: `${SHOTS}/03-comunicado-publicado.png`, fullPage: true });
});

await step("vera vê destaque no painel e o aviso no sininho; abrir marca como lido", async () => {
  await V.goto(`${BASE}/painel`);
  await V.getByRole("region", { name: "Comunicados importantes" }).getByText("Treinamento presencial na sexta").waitFor();
  await V.screenshot({ path: `${SHOTS}/04-painel-destaque.png` });
  await bell(V).click();
  await V.getByRole("dialog", { name: "Avisos" }).getByText("Treinamento presencial na sexta").click();
  await V.waitForURL(new RegExp(`/comunicados/${annId}`));
  await V.getByText("teremos treinamento no auditório", { exact: false }).waitFor();
  const n = await rest(`notifications?select=read_at&announcement_id=eq.${annId}`);
  assert.ok(n[0].read_at, "não marcou como lido");
  await V.goto(`${BASE}/painel`);
  assert.equal(await V.getByRole("region", { name: "Comunicados importantes" }).count(), 0);
  await V.goto(`${BASE}/comunicados`);
  await V.getByText("Treinamento presencial na sexta").waitFor();
  assert.equal(await V.getByRole("link", { name: "Novo comunicado" }).count(), 0);
});

await step("avaliação com resposta aberta avisa quem corrige", async () => {
  const vera = (await rest("profiles?select=id&email=eq.vera@implantta.com.br"))[0].id;
  const c = (await rest("contents?select=id&kind=eq.texto&limit=1"))[0];
  await rest("quiz_attempts", {
    method: "POST",
    body: JSON.stringify({ profile_id: vera, content_id: c.id, status: "em_correcao", score: 0, points_total: 1, passing_score: 70, answers: [] }),
  });
  await A.goto(`${BASE}/painel`);
  await bell(A).click();
  await A.getByRole("dialog", { name: "Avisos" }).getByText("Avaliação para corrigir").waitFor();
  await A.screenshot({ path: `${SHOTS}/05-sininho-gestor.png` });
  await A.keyboard.press("Escape");
});

await step("página Avisos: filtro e marcar todos como lidos", async () => {
  await V.goto(`${BASE}/notificacoes?filtro=nao-lidos`);
  await V.getByRole("heading", { name: "Avisos" }).waitFor();
  await V.screenshot({ path: `${SHOTS}/06-avisos.png`, fullPage: true });
  const btn = V.getByRole("button", { name: "Marcar todos como lidos" });
  if (await btn.count()) {
    await btn.click();
    await V.getByText("Tudo lido").waitFor();
  }
  await V.goto(`${BASE}/painel`);
  await V.waitForTimeout(800);
  assert.equal(await bell(V).getAttribute("aria-label"), "Avisos");
});

await step("admin arquiva; comunicado some para a vera", async () => {
  await A.goto(`${BASE}/comunicados/${annId}`);
  await A.getByRole("button", { name: "Arquivar" }).click();
  await A.getByRole("dialog").getByRole("button", { name: "Arquivar" }).click();
  await A.getByText("Comunicado arquivado").first().waitFor();
  await V.goto(`${BASE}/comunicados/${annId}`);
  await V.getByText(/não encontrada|404|não existe/i).first().waitFor();
});

await step("sininho no celular cabe na tela", async () => {
  const M = await open("vera@implantta.com.br", { width: 390, height: 844 });
  await M.goto(`${BASE}/painel`);
  await bell(M).click();
  const box = await M.getByRole("dialog", { name: "Avisos" }).boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 390, `painel fora da tela: ${box.x}+${box.width}`);
  await M.screenshot({ path: `${SHOTS}/07-celular.png` });
});

console.log(`\n${results.filter((r) => r === "ok").length}/${results.length} passos ok`);
await browser.close();
process.exit(0);
