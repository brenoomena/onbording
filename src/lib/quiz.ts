/** Avaliações: formato das perguntas, validação e textos (usado no editor e no servidor). */
import { z } from "zod";

export type QuestionKind = "unica" | "multipla" | "vf" | "aberta";

export const QUESTION_KIND_LABEL: Record<QuestionKind, string> = {
  unica: "Escolha única",
  multipla: "Múltipla escolha",
  vf: "Verdadeiro ou falso",
  aberta: "Resposta aberta",
};

export const QUESTION_KIND_HINT: Record<QuestionKind, string> = {
  unica: "Uma alternativa correta.",
  multipla: "Uma ou mais corretas; acerta quem marcar exatamente as corretas.",
  vf: "Marque se a afirmação é verdadeira ou falsa.",
  aberta: "A pessoa escreve a resposta; o gestor corrige e dá a nota.",
};

export interface QuizOption {
  id: string;
  label: string;
  correct: boolean;
}

export interface QuizQuestion {
  /** Chave só do editor (as perguntas são regravadas a cada salvamento). */
  key: string;
  kind: QuestionKind;
  prompt: string;
  explanation: string;
  points: number;
  options: QuizOption[];
}

const optionSchema = z.object({ id: z.string().min(1).max(40), label: z.string().trim().max(500), correct: z.boolean() });

const questionSchema = z
  .object({
    kind: z.enum(["unica", "multipla", "vf", "aberta"]),
    prompt: z.string().trim().max(2000),
    explanation: z.string().trim().max(2000).optional().default(""),
    points: z.coerce.number().int().min(1).max(100).default(1),
    options: z.array(optionSchema).max(10).default([]),
  })
  .transform((q) => ({ ...q, options: q.kind === "aberta" ? [] : q.options }));

/** Lê e valida as perguntas enviadas pelo editor. Devolve o erro em português. */
export function parseQuiz(raw: unknown): { ok: true; questions: z.output<typeof questionSchema>[] } | { ok: false; error: string } {
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw || "[]");
    } catch {
      return { ok: false, error: "Não foi possível ler as perguntas." };
    }
  }
  const parsed = z.array(questionSchema).max(100, "Use no máximo 100 perguntas.").safeParse(data);
  if (!parsed.success) return { ok: false, error: "Confira as perguntas da avaliação." };
  for (const [i, q] of parsed.data.entries()) {
    const n = `Pergunta ${i + 1}`;
    if (!q.prompt) return { ok: false, error: `${n}: escreva o enunciado.` };
    if (q.kind === "aberta") continue;
    if (q.options.length < 2) return { ok: false, error: `${n}: cadastre pelo menos 2 alternativas.` };
    if (q.options.some((o) => !o.label)) return { ok: false, error: `${n}: preencha o texto de todas as alternativas.` };
    const right = q.options.filter((o) => o.correct).length;
    if (q.kind === "multipla" && right < 1) return { ok: false, error: `${n}: marque ao menos uma alternativa correta.` };
    if ((q.kind === "unica" || q.kind === "vf") && right !== 1) return { ok: false, error: `${n}: marque exatamente uma alternativa correta.` };
    if (q.kind === "vf" && q.options.length !== 2) return { ok: false, error: `${n}: verdadeiro ou falso tem duas opções.` };
  }
  return { ok: true, questions: parsed.data };
}

/** Pergunta nova para o editor. */
export function newQuestion(kind: QuestionKind, id: () => string): QuizQuestion {
  const base = { key: id(), kind, prompt: "", explanation: "", points: 1 };
  if (kind === "aberta") return { ...base, options: [] };
  if (kind === "vf")
    return { ...base, options: [{ id: "v", label: "Verdadeiro", correct: true }, { id: "f", label: "Falso", correct: false }] };
  return { ...base, options: [{ id: id(), label: "", correct: true }, { id: id(), label: "", correct: false }] };
}

// ---------- Visão do colaborador (get_quiz) ----------
export interface LearnerQuiz {
  passing_score: number;
  max_attempts: number | null;
  attempts_used: number;
  best_score: number | null;
  approved: boolean;
  pending: boolean;
  can_attempt: boolean;
  last_attempt: LearnerAttempt | null;
  questions: { id: string; kind: QuestionKind; prompt: string; points: number; options: { id: string; label: string }[] }[];
}

export interface LearnerAttempt {
  id: string;
  submitted_at: string;
  status: "em_correcao" | "aprovada" | "reprovada";
  score: number;
  feedback: string | null;
  graded_at: string | null;
  questions: {
    question_id: string;
    prompt: string;
    kind: QuestionKind;
    points: number;
    awarded: number | null;
    correct: boolean | null;
    comment: string | null;
    text: string | null;
    explanation: string | null;
    options: { id: string; label: string; selected: boolean; correct: boolean | null }[];
  }[];
}

export const ATTEMPT_LABEL: Record<LearnerAttempt["status"], string> = {
  em_correcao: "Aguardando correção",
  aprovada: "Aprovado",
  reprovada: "Não atingiu a nota",
};
