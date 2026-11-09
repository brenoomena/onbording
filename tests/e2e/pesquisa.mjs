// Pesquisa de satisfação ponta a ponta (roda depois de etapa2.mjs).
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import { entrar } from "./auth-helper.mjs";

const BASE = "http://localhost:3000";
const API = "http://localhost:54321";
const SHOTS = "/var/tmp/sbstack/shots11";
fs.mkdirSync(SHOTS, { recursive: true });
const SK = process.env.SERVICE_KEY;
const H = { apikey: SK, Authorization: `Bearer ${SK}`, "Content-Type": "application/json", Prefer: "return=representation" };
const rest = async (path, init = {}) => {
  const r = await fetch(`${API}/rest/v1/${path}`, { headers: H, ...init });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${path}: ${t}`);
  return t ? JSON.parse(t) : null;
};
let ok = 0;
let fail = 0;
const pages = [];
const step = async (name, fn) => {
  try { await fn(); ok++; console.log("✔", name); }
  catch (e) {
    fail++; console.log("✘", name, "\n   ", e.message.split("\n").slice(0, 4).join(" | "));
    for (const [i, p] of pages.entries()) await p.screenshot({ path: `${SHOTS}/fail-${ok + fail}-${i}.png`, fullPage: true }).catch(() => {});
  }
};
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server"] });
const open = async (email, viewport = { width: 1440, height: 900 }) => {
  const ctx = await browser.newContext({ locale: "pt-BR", viewport, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("   [pageerror]", e.message.slice(0, 200)));
  if (email) await entrar(page, email);
  pages.push(page);
  return page;
};

const vera = (await rest("profiles?select=id&email=eq.vera@implantta.com.br"))[0].id;
const [track] = await rest("tracks", { method: "POST", body: JSON.stringify({ name: "Cultura Implantta", status: "publicado", is_sequential: false }) });
const [mod] = await rest("modules", { method: "POST", body: JSON.stringify({ track_id: track.id, title: "Quem somos", position: 1 }) });
const [content] = await rest("contents", { method: "POST", body: JSON.stringify({ title: "Nossos valores", kind: "texto", body: "Cliente no centro.", track_id: track.id, status: "publicado" }) });
await rest("module_items", { method: "POST", body: JSON.stringify({ module_id: mod.id, content_id: content.id, position: 1, is_required: true }) });
await rest("enrollments", { method: "POST", body: JSON.stringify({ profile_id: vera, track_id: track.id }) });

const V = await open("vera@implantta.com.br");
const A = await open("breno@implantta.com.br");

await step("antes de concluir, não há avaliação; ao concluir o conteúdo, aparece a nota do conteúdo", async () => {
  await V.goto(`${BASE}/minhas-trilhas/${track.id}`);
  assert.equal(await V.getByRole("region", { name: "Avaliar a trilha" }).count(), 0);
  await V.goto(`${BASE}/estudar/${content.id}?trilha=${track.id}`);
  assert.equal(await V.getByRole("region", { name: "Avaliar o conteúdo" }).count(), 0);
  await V.getByRole("button", { name: "Marcar como concluído" }).click();
  await V.getByRole("region", { name: "Avaliar o conteúdo" }).waitFor();
});

await step("avalia o conteúdo com 4 estrelas e comentário", async () => {
  const box = V.getByRole("region", { name: "Avaliar o conteúdo" });
  await box.getByRole("button", { name: "Enviar avaliação" }).click();
  await V.getByText("Escolha uma nota de 1 a 5 estrelas.").first().waitFor();
  await V.getByRole("button", { name: "OK" }).click();
  await box.getByText("Escolha uma nota.").waitFor();
  await box.locator('label[title="Boa"]').click();
  await box.getByRole("textbox").fill("Bem direto ao ponto.");
  await box.getByRole("button", { name: "Enviar avaliação" }).click();
  await V.getByRole("region", { name: "Sua avaliação do conteúdo" }).waitFor();
  await V.getByText("“Bem direto ao ponto.”").waitFor();
  const [cf] = await rest(`content_feedback?select=rating,comment,anonymous&content_id=eq.${content.id}`);
  assert.deepEqual(cf, { rating: 4, comment: "Bem direto ao ponto.", anonymous: false });
  await V.screenshot({ path: `${SHOTS}/1-conteudo.png`, fullPage: true });
});

await step("convite no sininho leva à avaliação da trilha", async () => {
  await V.goto(`${BASE}/painel`);
  await V.getByRole("button", { name: /Avisos|Notificações/ }).first().click();
  const link = V.getByRole("button", { name: /Como foi a trilha Cultura Implantta\?/ }).first();
  await link.waitFor();
  await V.screenshot({ path: `${SHOTS}/2-sininho.png` });
  await link.click();
  await V.waitForURL(/avaliar=1/);
  await V.getByRole("region", { name: "Avaliar a trilha" }).waitFor();
  await V.getByRole("heading", { name: "Como foi a trilha Cultura Implantta?" }).waitFor();
  await V.screenshot({ path: `${SHOTS}/3-trilha-form.png`, fullPage: true });
});

await step("avalia a trilha com 2 estrelas, anônima; depois altera para 3", async () => {
  const box = V.getByRole("region", { name: "Avaliar a trilha" });
  await box.locator('label[title="Ruim"]').click();
  await box.getByText("Ruim", { exact: true }).waitFor();
  await box.getByRole("textbox").fill("Faltaram exemplos práticos.");
  await box.getByLabel("Enviar sem meu nome para o RH").check();
  await box.getByRole("button", { name: "Enviar avaliação" }).click();
  const mine = V.getByRole("region", { name: "Sua avaliação da trilha" });
  await mine.waitFor();
  await mine.getByRole("button", { name: "Alterar" }).click();
  const edit = V.getByRole("region", { name: "Avaliar a trilha" });
  assert.equal(await edit.getByLabel("Enviar sem meu nome para o RH").isChecked(), true);
  await edit.locator('label[title="Regular"]').click();
  await edit.getByRole("button", { name: "Salvar avaliação" }).click();
  await V.getByRole("region", { name: "Sua avaliação da trilha" }).getByText("Regular").waitFor();
  const [tf] = await rest(`track_feedback?select=rating,comment,anonymous&track_id=eq.${track.id}`);
  assert.deepEqual(tf, { rating: 3, comment: "Faltaram exemplos práticos.", anonymous: true });
  const [n] = await rest(`notifications?select=read_at&kind=eq.pesquisa&profile_id=eq.${vera}&link=like.*${track.id}*`);
  assert.ok(n.read_at, "convite marcado como lido");
  await V.screenshot({ path: `${SHOTS}/4-trilha-avaliada.png`, fullPage: true });
});

await step("colaborador não vê o menu nem a página do relatório", async () => {
  assert.equal(await V.getByRole("link", { name: "Pesquisa de satisfação" }).count(), 0);
  const r = await V.goto(`${BASE}/pesquisa`);
  assert.ok(r.status() === 403 || (await V.getByText(/permissão|acesso/i).count()) > 0, "bloqueado");
  const x = await V.request.get(`${BASE}/pesquisa/exportar?formato=csv`);
  assert.equal(x.status(), 403);
});

await step("RH vê o relatório: indicadores, trilha, conteúdo e comentários (anônimo sem nome)", async () => {
  await A.goto(`${BASE}/painel`);
  await A.getByRole("link", { name: "Pesquisa de satisfação" }).first().click();
  await A.waitForURL(/\/pesquisa$/);
  await A.getByRole("heading", { name: "Pesquisa de satisfação" }).waitFor();
  const row = A.getByRole("row", { name: /Cultura Implantta/ });
  await row.waitFor();
  assert.match(await row.innerText(), /3,0[\s\S]*1\s*de 1[\s\S]*100%/);
  await A.screenshot({ path: `${SHOTS}/5-rh-trilhas.png`, fullPage: true });
  await A.getByRole("link", { name: /Conteúdos/ }).filter({ hasText: /^\s*Conteúdos/ }).last().click();
  await A.getByRole("row", { name: /Nossos valores/ }).getByText("4,0").waitFor();
  await A.screenshot({ path: `${SHOTS}/6-rh-conteudos.png`, fullPage: true });
  await A.goto(`${BASE}/pesquisa?vista=comentarios`);
  const anon = A.getByRole("listitem").filter({ hasText: "Faltaram exemplos práticos." });
  await anon.getByText("Anônimo").waitFor();
  assert.equal(await anon.getByText("Vera").count(), 0);
  await A.getByRole("listitem").filter({ hasText: "Bem direto ao ponto." }).getByText(/Vera Vendedora/).waitFor();
  await A.getByRole("link", { name: /^3\s*estrelas$/ }).click();
  await A.waitForURL(/nota=3/);
  assert.equal(await A.getByRole("listitem").filter({ hasText: "Bem direto ao ponto." }).count(), 0);
  await A.screenshot({ path: `${SHOTS}/7-rh-comentarios.png`, fullPage: true });
});

await step("filtro de período antigo esvazia; exportação CSV e Excel", async () => {
  await A.goto(`${BASE}/pesquisa?periodo=personalizado&de=2020-01-01&ate=2020-12-31`);
  await A.getByText("Nenhuma trilha concluída ou avaliada no período").waitFor();
  const csv = await A.request.get(`${BASE}/pesquisa/exportar?formato=csv&periodo=tudo`);
  assert.equal(csv.status(), 200);
  const text = await csv.text();
  assert.match(text, /Trilha;Nota média;Avaliações;Conclusões;Taxa de resposta/);
  assert.match(text, /Cultura Implantta;3;1;1;100%;0;0;1;0;0;1/);
  const com = await (await A.request.get(`${BASE}/pesquisa/exportar?formato=csv&periodo=tudo&vista=comentarios`)).text();
  assert.match(com, /Faltaram exemplos práticos\.;Anônimo/);
  const x = await A.request.get(`${BASE}/pesquisa/exportar?formato=xlsx&vista=conteudos`);
  assert.equal(x.status(), 200);
  assert.match(x.headers()["content-type"], /spreadsheetml/);
});

await step("celular: formulário e relatório cabem na tela", async () => {
  const M = await open("breno@implantta.com.br", { width: 390, height: 844 });
  await M.goto(`${BASE}/pesquisa?periodo=tudo`);
  await M.getByRole("heading", { name: "Pesquisa de satisfação" }).waitFor();
  const w = await M.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(w <= 392, `rolagem horizontal: ${w}`);
  await M.screenshot({ path: `${SHOTS}/8-celular.png`, fullPage: true });
});

console.log(`pesquisa: ${ok} ok, ${fail} falhas`);
await browser.close();
