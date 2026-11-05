// Acompanhamento: roda depois de etapa2.mjs (usa a trilha e a vendedora criadas lá).
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import { entrar } from "./auth-helper.mjs";

const BASE = "http://localhost:3000";
const API = "http://localhost:54321";
const SHOTS = "/var/tmp/sbstack/shots3";
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
  try {
    await fn();
    results.push(["ok", name]);
    console.log("✔", name);
  } catch (e) {
    results.push(["FAIL", name]);
    console.log("✘", name, "\n   ", e.message.split("\n").slice(0, 4).join(" | "));
  }
};
const PASS = "SenhaForte!2026";
async function makeUser(email, name, roleKey, extra = {}) {
  const r = await fetch(`${API}/auth/v1/admin/users`, { method: "POST", headers: H, body: JSON.stringify({ email, password: PASS, email_confirm: true }) });
  const u = await r.json();
  if (!u.id) throw new Error(JSON.stringify(u));
  const role = (await rest(`roles?select=id&key=eq.${roleKey}`))[0].id;
  await rest("profiles", { method: "POST", body: JSON.stringify({ id: u.id, full_name: name, email, role_id: role, status: "ativo", ...extra }) });
  return u.id;
}

// ---------------------------------------------------------------- dados
const track = (await rest("tracks?select=id,name&name=eq.Onboarding%20Comercial"))[0];
const vera = (await rest("profiles?select=id&email=eq.vera@implantta.com.br"))[0].id;
const sup = await makeUser("silvio.sup@implantta.com.br", "Sílvio Supervisor", "supervisor");
const time = await makeUser("tais.time@implantta.com.br", "Taís do Time", "colaborador", { supervisor_id: sup, admission_date: "2026-10-15" });
await rest("enrollments", { method: "POST", body: JSON.stringify({ profile_id: time, track_id: track.id, origin: "manual", due_date: "2026-12-20", assigned_at: "2026-09-01T12:00:00Z" }) });
// Vera atrasada: prazo vencido na trilha comercial.
await rest(`enrollments?profile_id=eq.${vera}&track_id=eq.${track.id}`, { method: "PATCH", body: JSON.stringify({ due_date: "2026-10-01" }) });
await rest(`profiles?id=eq.${vera}`, { method: "PATCH", body: JSON.stringify({ admission_date: "2026-08-03" }) });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server"] });
const login = async (email, viewport = { width: 1440, height: 900 }) => {
  const ctx = await browser.newContext({ locale: "pt-BR", viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("   [pageerror]", e.message.slice(0, 160)));
  await entrar(page, email);
  await page.waitForURL(/\/painel/);
  return page;
};
const stat = (page, label) => page.locator("p", { hasText: new RegExp(`^${label}$`) }).first().locator("xpath=following-sibling::p[1]").innerText();

const A = await login("breno@implantta.com.br");

await step("menu mostra Acompanhamento e a página abre com indicadores", async () => {
  await A.getByRole("link", { name: "Acompanhamento" }).first().click();
  await A.waitForURL(/\/acompanhamento/);
  await A.getByRole("heading", { name: "Acompanhamento" }).waitFor();
  const breno = (await rest("profiles?select=id&email=eq.breno@implantta.com.br"))[0].id;
  const all = await rest("enrollments?select=profile_id,profile:profiles!inner(status),track:tracks!inner(status)");
  const expected = all.filter((e) => e.profile_id !== breno && e.profile.status !== "inativo" && e.track.status !== "arquivado").length;
  assert.equal(await stat(A, "Matrículas"), String(expected));
  await A.screenshot({ path: `${SHOTS}/01-pessoas.png`, fullPage: true });
});

await step("em atraso bate com o Painel", async () => {
  const here = await stat(A, "Em atraso");
  await A.goto(`${BASE}/painel`);
  const painel = await stat(A, "Em atraso");
  assert.equal(here, painel);
  assert.ok(Number(here) >= 1);
});

await step("visão Pessoas: Vera aparece com atraso, Taís em dia", async () => {
  await A.goto(`${BASE}/acompanhamento`);
  const vRow = A.locator("tr", { hasText: "Vera Vendedora" });
  await vRow.getByText("1 em atraso").waitFor();
  await A.locator("tr", { hasText: "Taís do Time" }).waitFor();
});

await step("filtro por situação e indicador clicável", async () => {
  await A.locator("a", { has: A.locator("p", { hasText: /^Em atraso$/ }) }).click();
  await A.waitForURL(/vista=atencao/);
  assert.ok(A.url().includes("situacao=atrasada"));
  await A.locator("tr", { hasText: "Vera Vendedora" }).getByText("Prazo vencido").waitFor();
  assert.equal(await A.locator("tbody tr", { hasText: "Taís do Time" }).count(), 0);
  await A.screenshot({ path: `${SHOTS}/02-atencao.png`, fullPage: true });
});

await step("filtro de admissão por formulário", async () => {
  await A.goto(`${BASE}/acompanhamento`);
  await A.fill("#f-de", "2026-10-01");
  await A.getByRole("button", { name: "Filtrar" }).click();
  await A.waitForURL(/de=2026-10-01/);
  await A.locator("tr", { hasText: "Taís do Time" }).waitFor();
  assert.equal(await A.locator("tbody tr", { hasText: "Vera Vendedora" }).count(), 0);
});

await step("visão Trilhas e etapas onde as pessoas param", async () => {
  await A.goto(`${BASE}/acompanhamento?vista=trilhas`);
  const row = A.locator("tr", { hasText: "Onboarding Comercial" });
  await row.getByRole("link", { name: "Ver etapas" }).click();
  await A.waitForURL(/etapas=/);
  await A.getByText(/Onde as pessoas param · Onboarding Comercial/).waitFor();
  await A.getByText(/Maior queda/).waitFor();
  await A.screenshot({ path: `${SHOTS}/03-trilhas-etapas.png`, fullPage: true });
});

await step("exporta CSV e Excel com os filtros", async () => {
  const csv = await A.request.get(`${BASE}/acompanhamento/exportar?formato=csv&vista=atencao&situacao=atrasada`);
  assert.equal(csv.status(), 200);
  const text = await csv.text();
  assert.ok(text.startsWith("﻿Colaborador;E-mail;Supervisor;Trilha"), text.slice(0, 80));
  assert.ok(text.includes("Vera Vendedora") && !text.includes("Taís"), "CSV respeita o filtro");
  assert.ok(text.includes("01/10/2026"), "data em dd/mm/aaaa");
  const xlsx = await A.request.get(`${BASE}/acompanhamento/exportar?formato=xlsx`);
  assert.equal(xlsx.status(), 200);
  assert.match(xlsx.headers()["content-type"], /spreadsheetml/);
  assert.match(xlsx.headers()["content-disposition"], /acompanhamento-pessoas-.*\.xlsx/);
  const buf = await xlsx.body();
  assert.equal(buf.subarray(0, 2).toString(), "PK");
  fs.writeFileSync(`${SHOTS}/export.xlsx`, buf);
  // Botão de download na tela
  await A.goto(`${BASE}/acompanhamento?vista=trilhas`);
  const [dl] = await Promise.all([A.waitForEvent("download"), A.getByRole("link", { name: "CSV" }).click()]);
  assert.match(dl.suggestedFilename(), /^acompanhamento-trilhas-\d{4}-\d{2}-\d{2}\.csv$/);
});

await step("ajuste rápido de prazo tira da lista de atraso", async () => {
  await A.goto(`${BASE}/acompanhamento?vista=atencao&situacao=atrasada`);
  const row = A.locator("tr", { hasText: "Vera Vendedora" });
  await row.locator("input[type=date]").fill("2027-01-31");
  await row.getByRole("button", { name: "Salvar" }).click();
  await A.getByText("Prazo salvo.").waitFor();
  await A.reload();
  await A.getByRole("heading", { name: "Acompanhamento" }).waitFor();
  assert.equal(await A.locator("tbody tr", { hasText: "Vera Vendedora" }).count(), 0);
  const due = (await rest(`enrollments?select=due_date&profile_id=eq.${vera}&track_id=eq.${track.id}`))[0].due_date;
  assert.equal(due, "2027-01-31");
});

await step("nome abre a ficha em janela lateral", async () => {
  await A.goto(`${BASE}/acompanhamento`);
  await A.getByRole("link", { name: "Taís do Time" }).click();
  await A.getByRole("dialog").getByText("Taís do Time").first().waitFor();
});

await step("supervisor vê só a própria equipe, inclusive na exportação", async () => {
  const S = await login("silvio.sup@implantta.com.br");
  await S.goto(`${BASE}/acompanhamento`);
  await S.locator("tr", { hasText: "Taís do Time" }).waitFor();
  assert.equal(await S.locator("tbody tr", { hasText: "Vera Vendedora" }).count(), 0);
  assert.equal(await S.locator("#f-sup").count(), 0, "sem filtro de supervisor");
  await S.getByText(/Progresso da sua equipe/).waitFor();
  const csv = await (await S.request.get(`${BASE}/acompanhamento/exportar?formato=csv`)).text();
  assert.ok(csv.includes("Taís do Time") && !csv.includes("Vera"), "exportação só da equipe");
  await S.screenshot({ path: `${SHOTS}/04-supervisor.png`, fullPage: true });
  await S.context().close();
});

await step("colaborador não acessa (página e exportação)", async () => {
  const V = await login("vera@implantta.com.br");
  assert.equal(await V.getByRole("link", { name: "Acompanhamento" }).count(), 0);
  await V.goto(`${BASE}/acompanhamento`);
  await V.getByText("Sem permissão para esta página").waitFor();
  const r = await V.request.get(`${BASE}/acompanhamento/exportar?formato=csv`);
  assert.equal(r.status(), 403);
  await V.context().close();
});

await step("celular e modo escuro", async () => {
  const M = await login("breno@implantta.com.br", { width: 390, height: 844 });
  await M.goto(`${BASE}/acompanhamento`);
  const overflow = await M.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `rolagem horizontal ${overflow}px`);
  await M.screenshot({ path: `${SHOTS}/05-celular.png`, fullPage: false });
  await M.context().addCookies([{ name: "tema", value: "escuro", url: BASE }]);
  await M.setViewportSize({ width: 1440, height: 900 });
  await M.goto(`${BASE}/acompanhamento?vista=trilhas`);
  await M.screenshot({ path: `${SHOTS}/06-escuro.png`, fullPage: true });
  await M.context().close();
});

const ok = results.filter((r) => r[0] === "ok").length;
console.log(`\n${ok}/${results.length} passos ok`);
await browser.close();
process.exit(ok === results.length ? 0 : 1);
