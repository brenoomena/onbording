import { describe, expect, it } from "vitest";
import { newQuestion, parseQuiz } from "@/lib/quiz";

let n = 0;
const id = () => `o${++n}`;
const q = (kind: Parameters<typeof newQuestion>[0], patch: Record<string, unknown> = {}) => {
  const { key: _key, ...rest } = newQuestion(kind, id);
  return { ...rest, prompt: "Pergunta?", ...patch };
};
const opts = (...correct: boolean[]) => correct.map((c, i) => ({ id: `x${i}`, label: `Op ${i}`, correct: c }));

describe("parseQuiz", () => {
  it("aceita os quatro tipos bem preenchidos", () => {
    const r = parseQuiz(
      JSON.stringify([
        q("unica", { options: opts(true, false) }),
        q("multipla", { options: opts(true, true, false) }),
        q("vf"),
        q("aberta", { points: 3 }),
      ]),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.questions.map((x) => x.kind)).toEqual(["unica", "multipla", "vf", "aberta"]);
  });

  it("aceita lista vazia (rascunho)", () => {
    expect(parseQuiz("")).toEqual({ ok: true, questions: [] });
  });

  it.each([
    ["sem enunciado", [q("aberta", { prompt: "  " })], "Pergunta 1: escreva o enunciado."],
    ["única com duas corretas", [q("unica", { options: opts(true, true) })], "Pergunta 1: marque exatamente uma alternativa correta."],
    ["múltipla sem correta", [q("multipla", { options: opts(false, false) })], "Pergunta 1: marque ao menos uma alternativa correta."],
    ["alternativa vazia", [q("unica", { options: [...opts(true), { id: "z", label: "", correct: false }] })], "Pergunta 1: preencha o texto de todas as alternativas."],
    ["uma alternativa só", [q("unica", { options: opts(true) })], "Pergunta 1: cadastre pelo menos 2 alternativas."],
  ])("recusa %s", (_, data, msg) => {
    expect(parseQuiz(JSON.stringify(data))).toEqual({ ok: false, error: msg });
  });

  it("recusa JSON inválido", () => {
    expect(parseQuiz("{")).toEqual({ ok: false, error: "Não foi possível ler as perguntas." });
  });
});
