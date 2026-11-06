// Avaliações ponta a ponta (roda depois de etapa2.mjs).
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import { entrar } from "./auth-helper.mjs";

const BASE = "http://localhost:3000";
const SHOTS = "/var/tmp/sbstack/shots4";
fs.mkdirSync(SHOTS, { recursive: true });
const SK = process.env.SERVICE_KEY;
const H = { apikey: SK, Authorization: `Bearer ${SK}` };
const rest = async (path) => (await fetch(`http://localhost:54321/rest/v1/${path}`, { headers: H })).json();
const results = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push("ok");
    console.log("✔", name);
  } catch (e) {
    results.push("FAIL");
    try { await A.screenshot({ path: `${SHOTS}/fail-${results.length}.png` }); console.log("   url", A.url()); } catch {}
    console.log("✘", name, "\n   ", e.message.split("\n").slice(0, 3).join(" | "));
  }
};
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-proxy-server"] });
const open = async (email, viewport = { width: 1440, height: 900 }) => {
  const page = await (await browser.newContext({ locale: "pt-BR", viewport })).newPage();
  page.on("pageerror", (e) => console.log("   [pageerror]", e.message.slice(0, 200)));
  await entrar(page, email);
  return page;
};
const track = (await rest("tracks?select=id&name=eq.Onboarding%20Comercial"))[0].id;
const A = await open("breno@implantta.com.br");
let quizId;

await step("Novo conteúdo não oferece mais Avaliação no formato", async () => {
  await A.goto(`${BASE}/trilhas/${track}`);
  await A.getByRole("complementary", { name: "Partes da trilha" }).getByRole("button", { name: /Visão geral/ }).click();
  await A.getByRole("button", { name: "Novo conteúdo", exact: true }).click();
  const panel = A.getByRole("region", { name: "Novo conteúdo" });
  await panel.getByText("Link externo").waitFor();
  assert.equal(await panel.locator("label", { hasText: /^Avaliação$/ }).count(), 0);
});

await step("admin cria avaliação pela aba Nova avaliação, no fim de um módulo, com 3 tipos de pergunta", async () => {
  await A.getByRole("button", { name: "Fechar painel" }).filter({ visible: true }).click();
  await A.getByRole("button", { name: "Nova avaliação", exact: true }).click();
  const P = A.getByRole("region", { name: "Nova avaliação" });
  await P.getByText("No fim de um módulo", { exact: true }).click();
  await P.locator("#aval-module").selectOption({ index: 0 });
  await P.locator("input[name=module_required]").uncheck();
  await P.locator("#aval-title").fill("Avaliação de produtos");
  await P.locator("#aval-passing_score").fill("60");
  await P.getByRole("button", { name: "Escolha única" }).click();
  await P.getByPlaceholder("Escreva a pergunta").first().fill("Qual sistema faz a folha de pagamento?");
  await P.getByLabel("Texto da alternativa 1").fill("Domínio Folha");
  await P.getByLabel("Texto da alternativa 2").fill("Planilha");
  await P.getByRole("button", { name: "Verdadeiro ou falso" }).click();
  await P.getByPlaceholder("Escreva a afirmação").fill("O Domínio Escrita Fiscal apura impostos.");
  await P.getByRole("button", { name: "Resposta aberta" }).click();
  await P.getByPlaceholder("Escreva a pergunta").last().fill("Como você apresentaria o Domínio a um cliente?");
  await P.getByLabel("Pontos da pergunta 3").fill("2");
  await A.screenshot({ path: `${SHOTS}/01-aba-avaliacao.png` });
  await P.getByRole("button", { name: "Criar e publicar" }).click();
  await A.getByText(/publicada e incluída no fim do módulo/).waitFor();
  const c = (await rest("contents?select=id,kind,passing_score&title=eq.Avalia%C3%A7%C3%A3o%20de%20produtos"))[0];
  quizId = c.id;
  assert.equal(c.kind, "avaliacao");
  assert.equal(c.passing_score, 60);
  const qs = await rest(`quiz_questions?select=kind,points,options&content_id=eq.${quizId}&order=position`);
  assert.deepEqual(qs.map((q) => [q.kind, q.points]), [["unica", 1], ["vf", 1], ["aberta", 2]]);
  assert.equal(qs[0].options.find((o) => o.correct).label, "Domínio Folha");
  const mi = await rest(`module_items?select=position,module:modules(position)&content_id=eq.${quizId}`);
  assert.equal(mi[0].module.position, 1);
});

await step("avaliação no fim da trilha cria o módulo 'Avaliação final' (e reaproveita)", async () => {
  const before = (await rest(`modules?select=id&track_id=eq.${track}`)).length;
  for (const t of ["Prova final A", "Prova final B"]) {
    await A.goto(`${BASE}/trilhas/${track}?painel=avaliacao`);
    const P = A.getByRole("region", { name: "Nova avaliação" });
    await P.locator("#aval-title").fill(t);
    await P.getByRole("button", { name: "Verdadeiro ou falso" }).click();
    await P.getByPlaceholder("Escreva a afirmação").fill("Afirmação.");
    await P.getByRole("button", { name: "Salvar rascunho" }).click();
    await A.getByText(/no fim da trilha, no módulo "Avaliação final"/).waitFor();
  }
  const mods = await rest(`modules?select=title,position&track_id=eq.${track}&order=position`);
  assert.equal(mods.length, before + 1);
  assert.equal(mods.at(-1).title, "Avaliação final");
  await A.getByRole("complementary", { name: "Partes da trilha" }).getByRole("button", { name: /Avaliação final/ }).click();
  await A.getByRole("link", { name: "Prova final B" }).waitFor();
  await A.screenshot({ path: `${SHOTS}/01b-estrutura.png`, fullPage: true });
});

await step("pergunta sem enunciado é recusada com mensagem clara", async () => {
  await A.goto(`${BASE}/conteudos/${quizId}`);
  await A.getByRole("button", { name: "Escolha única" }).click();
  await A.getByRole("button", { name: "Salvar alterações" }).click();
  await A.getByText("Pergunta 4: escreva o enunciado.").first().waitFor();
});

const V = await open("vera@implantta.com.br");
await step("colaboradora vê a prova sem gabarito e sem 'Marcar como concluído'", async () => {
  await V.goto(`${BASE}/estudar/${quizId}?trilha=${track}`);
  await V.getByText("Qual sistema faz a folha de pagamento?").waitFor();
  assert.equal(await V.getByRole("button", { name: "Marcar como concluído" }).count(), 0);
  const html = await V.content();
  assert.ok(!/"correct"\s*:\s*true|correct\\":true/.test(html), "gabarito não pode ir para a página");
  await V.screenshot({ path: `${SHOTS}/02-prova.png`, fullPage: true });
});

await step("errou: mostra a nota e permite tentar de novo, sem revelar a resposta", async () => {
  await V.getByLabel("Pergunta 1").getByText("Planilha").click();
  await V.getByLabel("Pergunta 2").getByText("Falso").click();
  await V.getByLabel("Resposta da pergunta 3").fill("Mostraria os relatórios.");
  await V.getByRole("button", { name: "Enviar respostas" }).click();
  await V.getByText(/aguardando a correção do gestor/).waitFor();
  assert.equal(await V.getByRole("button", { name: "Tentar de novo" }).count(), 0, "não refaz enquanto está em correção");
  await V.screenshot({ path: `${SHOTS}/03-em-correcao.png`, fullPage: true });
});

await step("gestor corrige na aba Correções do Acompanhamento", async () => {
  await A.goto(`${BASE}/acompanhamento?vista=correcoes`);
  const row = A.locator("tr", { hasText: "Vera Vendedora" });
  await row.getByText("Avaliação de produtos").waitFor();
  await A.screenshot({ path: `${SHOTS}/04-correcoes.png`, fullPage: true });
  await row.getByRole("link", { name: "Corrigir" }).click();
  await A.getByRole("dialog").getByText("Mostraria os relatórios.").waitFor();
  await A.screenshot({ path: `${SHOTS}/05-corrigir.png` });
  await A.getByRole("dialog").getByLabel("Nota (0 a 2)").fill("1");
  await A.getByRole("dialog").getByLabel("Parecer final").fill("Revise o módulo de produtos e tente de novo.");
  await A.getByRole("dialog").getByRole("button", { name: "Concluir correção" }).click();
  await A.getByText(/Correção salva: não atingiu a nota mínima com 25%/).waitFor();
});

await step("colaboradora vê o resultado e o parecer; refaz e é aprovada; a etapa conclui", async () => {
  await V.reload();
  await V.getByText("Você fez 25%; a nota mínima é 60%").waitFor();
  await V.getByText("Revise o módulo de produtos e tente de novo.").waitFor();
  // Reprovada: não mostra a alternativa correta
  assert.equal(await V.locator("li.bg-ok-soft").count(), 0);
  await V.getByRole("button", { name: "Tentar de novo" }).click();
  await V.getByLabel("Pergunta 1").getByText("Domínio Folha").click();
  await V.getByLabel("Pergunta 2").getByText("Verdadeiro").click();
  await V.getByLabel("Resposta da pergunta 3").fill("Mostraria a integração entre os módulos e a economia de tempo.");
  await V.getByRole("button", { name: "Enviar respostas" }).click();
  await V.getByText(/aguardando a correção do gestor/).waitFor();
  const att = (await rest(`quiz_attempts?select=id&content_id=eq.${quizId}&status=eq.em_correcao`))[0].id;
  await A.goto(`${BASE}/acompanhamento/correcao/${att}`);
  await A.getByLabel("Nota (0 a 2)").fill("2");
  await A.getByRole("button", { name: "Concluir correção" }).click();
  await A.waitForURL(/vista=correcoes/);
  await A.getByText(/Correção salva: aprovada com 100%/).waitFor();
  await V.reload();
  await V.getByText("Aprovado com 100%").waitFor();
  await V.getByText(/Concluído em/).waitFor();
  const cp = await rest(`content_progress?select=status&content_id=eq.${quizId}`);
  assert.equal(cp[0].status, "concluido");
  await V.screenshot({ path: `${SHOTS}/06-aprovado.png`, fullPage: true });
});

await step("pré-visualização do gestor não envia", async () => {
  await A.goto(`${BASE}/estudar/${quizId}?previa=1`);
  await A.getByText("dá para marcar as respostas, mas elas não são enviadas").waitFor();
  assert.ok(await A.getByRole("button", { name: "Enviar respostas" }).isDisabled());
});

await step("acompanhamento mostra a etapa e o celular cabe", async () => {
  const M = await open("vera@implantta.com.br", { width: 390, height: 844 });
  await M.goto(`${BASE}/estudar/${quizId}?trilha=${track}`);
  const overflow = await M.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `rolagem lateral ${overflow}`);
  await M.screenshot({ path: `${SHOTS}/07-celular.png`, fullPage: true });
});

const ok = results.filter((r) => r === "ok").length;
console.log(`\n${ok}/${results.length} passos ok`);
await browser.close();
process.exit(0);
