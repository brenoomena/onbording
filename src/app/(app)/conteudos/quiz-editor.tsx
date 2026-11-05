"use client";

import { ArrowDown, ArrowUp, CheckCircle2, CircleDot, ListChecks, MessageSquareText, Plus, SquareCheck, ToggleLeft, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Field, Input, Select, Textarea, buttonVariants, cx, iconButtonClass } from "@/components/ui";
import { QUESTION_KIND_HINT, QUESTION_KIND_LABEL, newQuestion, type QuestionKind, type QuizQuestion } from "@/lib/quiz";

const shortId = () => crypto.randomUUID().slice(0, 8);

const KIND_ICON: Record<QuestionKind, typeof CircleDot> = {
  unica: CircleDot,
  multipla: SquareCheck,
  vf: ToggleLeft,
  aberta: MessageSquareText,
};

/**
 * Editor das perguntas de uma avaliação. Tudo fica no navegador até salvar o
 * conteúdo: as perguntas vão num campo oculto ("quiz") e o servidor valida.
 */
export function QuizEditor({
  initial,
  passingScore,
  maxAttempts,
  error,
  disabled = false,
  idPrefix = "",
}: {
  initial: QuizQuestion[];
  passingScore: number;
  maxAttempts: number | null;
  error?: string;
  disabled?: boolean;
  /** Prefixo dos ids dos campos, quando há outro formulário na mesma página. */
  idPrefix?: string;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(initial);
  const total = questions.reduce((s, q) => s + q.points, 0);

  const update = (key: string, patch: Partial<QuizQuestion>) => setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const move = (i: number, dir: -1 | 1) =>
    setQuestions((qs) => {
      const next = [...qs];
      const [it] = next.splice(i, 1);
      next.splice(i + dir, 0, it);
      return next;
    });
  const changeKind = (q: QuizQuestion, kind: QuestionKind) => {
    const fresh = newQuestion(kind, shortId);
    // Mantém enunciado, explicação e pontos; reaproveita as alternativas quando faz sentido.
    const keepOptions = (kind === "unica" || kind === "multipla") && (q.kind === "unica" || q.kind === "multipla") && q.options.length >= 2;
    let options = keepOptions ? q.options : fresh.options;
    if (kind === "unica" && keepOptions) {
      const first = options.findIndex((o) => o.correct);
      options = options.map((o, i) => ({ ...o, correct: i === (first < 0 ? 0 : first) }));
    }
    update(q.key, { kind, options });
  };

  const payload = JSON.stringify(
    questions.map(({ kind, prompt, explanation, points, options }) => ({ kind, prompt, explanation, points, options })),
  );

  return (
    <div className="grid gap-4">
      <input type="hidden" name="quiz" value={payload} />
      <div className="grid gap-4 rounded-xl border border-line bg-sunken/40 p-4 sm:grid-cols-3">
        <Field label="Nota mínima para aprovar (%)" htmlFor={`${idPrefix}passing_score`} hint="Calculada sobre os pontos das perguntas.">
          <Input id={`${idPrefix}passing_score`} name="passing_score" type="number" min={0} max={100} defaultValue={passingScore} required disabled={disabled} />
        </Field>
        <Field label="Tentativas" htmlFor={`${idPrefix}max_attempts`} hint="Vale a melhor nota.">
          <Select id={`${idPrefix}max_attempts`} name="max_attempts" defaultValue={maxAttempts ?? ""} disabled={disabled}>
            <option value="">Ilimitadas</option>
            {[1, 2, 3, 4, 5, 10].map((n) => (
              <option key={n} value={n}>
                Até {n} {n === 1 ? "tentativa" : "tentativas"}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid content-end gap-1 text-[13px] text-muted sm:pb-2">
          <span className="flex items-center gap-1.5 font-medium text-ink">
            <ListChecks size={16} aria-hidden className="text-icon" /> {questions.length} {questions.length === 1 ? "pergunta" : "perguntas"} · {total}{" "}
            {total === 1 ? "ponto" : "pontos"}
          </span>
          {questions.some((q) => q.kind === "aberta") && <span>Tem resposta aberta: o resultado sai depois da correção do gestor.</span>}
        </div>
      </div>

      {error && <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}

      <ol className="grid gap-3">
        {questions.map((q, i) => {
          const Icon = KIND_ICON[q.kind];
          const choice = q.kind !== "aberta";
          return (
            <li key={q.key} className="rounded-xl border border-line bg-surface">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
                <span className="flex items-center gap-1.5 font-mono text-[11.5px] font-semibold uppercase tracking-[0.06em] text-accent">
                  <Icon size={14} aria-hidden /> Pergunta {i + 1}
                </span>
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <Select
                    aria-label={`Tipo da pergunta ${i + 1}`}
                    value={q.kind}
                    onChange={(e) => changeKind(q, e.target.value as QuestionKind)}
                    className="w-auto py-1 text-[13px]"
                    disabled={disabled}
                  >
                    {(Object.keys(QUESTION_KIND_LABEL) as QuestionKind[]).map((k) => (
                      <option key={k} value={k}>
                        {QUESTION_KIND_LABEL[k]}
                      </option>
                    ))}
                  </Select>
                  <label className="flex items-center gap-1 text-[12.5px] text-muted">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={q.points}
                      onChange={(e) => update(q.key, { points: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })}
                      aria-label={`Pontos da pergunta ${i + 1}`}
                      className="w-16 py-1 text-[13px]"
                      disabled={disabled}
                    />
                    pts
                  </label>
                  <button type="button" onClick={() => move(i, -1)} disabled={disabled || i === 0} className={iconButtonClass("neutral")} title="Subir" aria-label={`Subir pergunta ${i + 1}`}>
                    <ArrowUp size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={disabled || i === questions.length - 1}
                    className={iconButtonClass("neutral")}
                    title="Descer"
                    aria-label={`Descer pergunta ${i + 1}`}
                  >
                    <ArrowDown size={15} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}
                    disabled={disabled}
                    className={iconButtonClass("danger")}
                    title="Remover pergunta"
                    aria-label={`Remover pergunta ${i + 1}`}
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </div>
              </div>

              <div className="grid gap-3 p-4">
                <Field label="Enunciado" htmlFor={`q-${q.key}`}>
                  <Textarea
                    id={`q-${q.key}`}
                    rows={2}
                    value={q.prompt}
                    onChange={(e) => update(q.key, { prompt: e.target.value })}
                    maxLength={2000}
                    placeholder={q.kind === "vf" ? "Escreva a afirmação" : "Escreva a pergunta"}
                    disabled={disabled}
                  />
                </Field>

                {choice ? (
                  <fieldset className="grid gap-2">
                    <legend className="mb-1 text-[12.5px] text-muted">
                      {QUESTION_KIND_HINT[q.kind]} {q.kind !== "vf" && "Marque a(s) correta(s)."}
                    </legend>
                    {q.options.map((o, oi) => (
                      <div key={o.id} className={cx("flex items-center gap-2 rounded-lg border px-2.5 py-1.5", o.correct ? "border-ok/40 bg-ok-soft/50" : "border-line")}>
                        <input
                          type={q.kind === "multipla" ? "checkbox" : "radio"}
                          name={`correct-${q.key}`}
                          checked={o.correct}
                          onChange={(e) =>
                            update(q.key, {
                              options: q.options.map((x) =>
                                q.kind === "multipla" ? (x.id === o.id ? { ...x, correct: e.target.checked } : x) : { ...x, correct: x.id === o.id },
                              ),
                            })
                          }
                          aria-label={`Alternativa ${oi + 1} correta`}
                          className="h-4 w-4 shrink-0 accent-[rgb(var(--ok))]"
                          disabled={disabled}
                        />
                        {q.kind === "vf" ? (
                          <span className="py-1 text-[14px]">{o.label}</span>
                        ) : (
                          <Input
                            value={o.label}
                            onChange={(e) => update(q.key, { options: q.options.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)) })}
                            placeholder={`Alternativa ${oi + 1}`}
                            aria-label={`Texto da alternativa ${oi + 1}`}
                            maxLength={500}
                            className="border-0 bg-transparent px-1 py-1 shadow-none focus:ring-0"
                            disabled={disabled}
                          />
                        )}
                        {o.correct && <CheckCircle2 size={16} aria-label="Correta" className="shrink-0 text-ok" />}
                        {q.kind !== "vf" && q.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              const rest = q.options.filter((x) => x.id !== o.id);
                              if (q.kind === "unica" && o.correct) rest[0] = { ...rest[0], correct: true };
                              update(q.key, { options: rest });
                            }}
                            className="rounded p-1 text-muted hover:text-danger"
                            aria-label={`Remover alternativa ${oi + 1}`}
                            disabled={disabled}
                          >
                            <X size={15} aria-hidden />
                          </button>
                        )}
                      </div>
                    ))}
                    {q.kind !== "vf" && q.options.length < 10 && (
                      <button
                        type="button"
                        onClick={() => update(q.key, { options: [...q.options, { id: shortId(), label: "", correct: false }] })}
                        className={cx(buttonVariants.ghost, "w-fit py-1 text-[13px]")}
                        disabled={disabled}
                      >
                        <Plus size={15} aria-hidden /> Alternativa
                      </button>
                    )}
                  </fieldset>
                ) : (
                  <p className="rounded-lg bg-sunken/60 px-3 py-2 text-[13px] text-muted">{QUESTION_KIND_HINT.aberta}</p>
                )}

                <Field label="Explicação (opcional)" htmlFor={`e-${q.key}`} hint="Aparece para a pessoa depois que ela for aprovada.">
                  <Textarea
                    id={`e-${q.key}`}
                    rows={2}
                    value={q.explanation}
                    onChange={(e) => update(q.key, { explanation: e.target.value })}
                    maxLength={2000}
                    disabled={disabled}
                  />
                </Field>
              </div>
            </li>
          );
        })}
      </ol>

      {questions.length === 0 && (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[13.5px] text-muted">
          Nenhuma pergunta ainda. Escolha abaixo o tipo da primeira.
        </p>
      )}

      {!disabled && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium">Adicionar pergunta:</span>
          {(Object.keys(QUESTION_KIND_LABEL) as QuestionKind[]).map((k) => {
            const Icon = KIND_ICON[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => setQuestions((qs) => [...qs, newQuestion(k, shortId)])}
                className={cx(buttonVariants.secondary, "py-1.5 text-[13px]")}
              >
                <Icon size={15} aria-hidden className="text-icon" /> {QUESTION_KIND_LABEL[k]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
