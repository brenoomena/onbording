// Gamificação ponta a ponta (roda depois de etapa2.mjs).
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import { entrar } from "./auth-helper.mjs";

const BASE = "http://localhost:3000";
const API = "http://localhost:54321";
const SHOTS = "/var/tmp/sbstack/shots8";
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
let A;
const step = async (name, fn) => {
  try { await fn(); results.push("ok"); console.log("✔", name); }
  catch (e) { results.push("FAIL"); console.log("✘", name, "\n   ", e.message.split("\n").slice(0, 3).join(" | ")); }
};
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server"] });
const open = async (email, viewport = { width: 1440, height: 900 }) => {
  const page = await (await browser.newContext({ locale: "pt-BR", viewport })).newPage();
  page.on("pageerror", (e) => console.log("   [pageerror]", e.message.slice(0, 200)));
  await entrar(page, email);
  return page;
};
const vera = (await rest("profiles?select=id,area_id&email=eq.vera@implantta.com.br"))[0];
const V = await open("vera@implantta.com.br");
const sum = async () => (await rest(`points_ledger?select=points&profile_id=eq.${vera.id}`)).reduce((s, r) => s + r.points, 0);

await step("conquistas: pontos já ganhos, medalha e ranking da área", async () => {
  const before = await sum();
  assert.ok(before > 0, "vera deveria ter pontos das etapas concluídas");
  await V.goto(`${BASE}/conquistas`);
  await V.getByRole("heading", { name: "Conquistas" }).waitFor();
  await V.getByText("Conquistada em").first().waitFor();
  await V.getByText("(você)").waitFor();
  await V.screenshot({ path: `${SHOTS}/01-conquistas.png`, fullPage: true });
});

await step("concluir trilha no prazo: +10 +50 +25, medalhas e aviso no sininho", async () => {
  const before = await sum();
  const [track] = await rest("tracks", { method: "POST", body: JSON.stringify({ name: "Cultura Implantta", status: "publicado", is_sequential: true }) });
  const [mod] = await rest("modules", { method: "POST", body: JSON.stringify({ track_id: track.id, title: "Valores", position: 1 }) });
  const [c] = await rest("contents", { method: "POST", body: JSON.stringify({ title: "Nossos valores", kind: "texto", body: "Respeito e entrega.", track_id: track.id, status: "publicado" }) });
  await rest("module_items", { method: "POST", body: JSON.stringify({ module_id: mod.id, content_id: c.id, position: 1, is_required: true }) });
  const due = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
  await rest("enrollments", { method: "POST", body: JSON.stringify({ profile_id: vera.id, track_id: track.id, due_date: due }) });
  await V.goto(`${BASE}/estudar/${c.id}?trilha=${track.id}`);
  await V.getByRole("button", { name: "Marcar como concluído" }).click();
  await V.waitForTimeout(1500);
  assert.equal((await sum()) - before, 85);
  await V.goto(`${BASE}/painel`);
  await V.getByRole("button", { name: /^Avisos/ }).click();
  await V.getByRole("dialog", { name: "Avisos" }).getByText("Nova medalha: Pontual").waitFor();
  await V.screenshot({ path: `${SHOTS}/02-aviso-medalha.png` });
  await V.keyboard.press("Escape");
});

await step("painel mostra pontos, posição e medalhas", async () => {
  await V.goto(`${BASE}/painel`);
  const s = V.getByRole("region", { name: "Minhas conquistas" });
  await s.getByText("Pontos no mês").waitFor();
  await s.getByRole("img", { name: "Pontual" }).waitFor();
  await V.screenshot({ path: `${SHOTS}/03-painel.png` });
});

await step("admin escolhe a área no ranking e vê a vera", async () => {
  A = await open("breno@implantta.com.br");
  await A.goto(`${BASE}/conquistas`);
  await A.getByLabel("Área do ranking").selectOption({ label: "Contábil" });
  await A.waitForURL(/area=|conquistas$/);
  await A.getByText("Vera Vendedora").waitFor();
  await A.getByRole("tab", { name: "Desde o início" }).click();
  await A.waitForURL(/periodo=total/);
  await A.getByText("Vera Vendedora").waitFor();
  await A.screenshot({ path: `${SHOTS}/04-ranking-admin.png`, fullPage: true });
});

await step("colaborador não consegue ver outra área pela URL", async () => {
  const other = (await rest(`areas?select=id&id=neq.${vera.area_id}&limit=1`))[0];
  await V.goto(`${BASE}/conquistas?area=${other.id}`);
  await V.getByText("(você)").waitFor();
});

await step("celular sem rolagem lateral", async () => {
  const M = await open("vera@implantta.com.br", { width: 390, height: 844 });
  for (const p of ["/conquistas", "/painel"]) {
    await M.goto(BASE + p);
    const o = await M.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (o > 1) {
      const wide = await M.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 6).map((e) => e.tagName + "." + String(e.className).slice(0, 80) + " " + Math.round(e.getBoundingClientRect().right)));
      console.log("   largos:", wide.join(" | "));
    }
    assert.ok(o <= 1, `${p} rola ${o}px`);
  }
  await M.goto(`${BASE}/conquistas`);
  await M.screenshot({ path: `${SHOTS}/05-celular.png`, fullPage: true });
});

console.log(`\n${results.filter((r) => r === "ok").length}/${results.length} passos ok`);
await browser.close();
process.exit(0);
