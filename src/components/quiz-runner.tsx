"use client";

import { AlarmClock, Check, CheckCircle2, CircleX, Hourglass, MessageSquareText, RotateCcw, Send, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { submitQuiz } from "@/app/(app)/estudar/actions";
import { Alert, Badge, buttonVariants, cx } from "@/components/ui";
import { ATTEMPT_LABEL, QUESTION_KIND_LABEL, type LearnerAttempt, type LearnerQuiz } from "@/lib/quiz";

type Answers = Record<string, { options: string[]; text: string }>;

const pct = (n: number | null | undefined) => `${Math.round(Number(n ?? 0))}%`;

/**
 * A prova para o colaborador: responde, envia e vê o resultado. O gabarito
 * nunca chega aqui; a correção é feita no banco. Na pré-visualização (gestor)
 * dá para ver e marcar, mas não enviar.
 */
export function QuizRunner({ contentId, quiz, preview = false, nextHref }: { contentId: string; quiz: LearnerQuiz; preview?: boolean; nextHref?: string }) {
  const router = useRouter();
  const last = quiz.last_attempt;
  // Mostra o resultado da última tentativa; "Tentar de novo" abre a prova.
  const [answering, setAnswering] = useState(preview || !last);
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmMissing, setConfirmMissing] = useState(false);
  const [pending, start] = useTransition();

  const missing = useMemo(
    () => quiz.questions.filter((q) => (q.kind === "aberta" ? !answers[q.id]?.text?.trim() : !answers[q.id]?.options?.length)).length,
    [answers, quiz.questions],
  );
  const total = quiz.questions.reduce((s, q) => s + q.points, 0);
  const attemptNo = quiz.attempts_used + 1;

  const set = (qid: string, patch: Partial<Answers[string]>) =>
    setAnswers((a) => ({ ...a, [qid]: { options: a[qid]?.options ?? [], text: a[qid]?.text ?? "", ...patch } }));

  function send() {
    if (preview) return;
    if (missing && !confirmMissing) {
      setConfirmMissing(true);
      return;
    }
    setError(null);
    start(async () => {
      const res = await submitQuiz(contentId, answers);
      if (res.error) {
        setError(res.error);
        return;
      }
      setAnswers({});
      setConfirmMissing(false);
      setAnswering(false);
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (!quiz.questions.length) {
    return <Alert tone="warn">Esta avaliação ainda não tem perguntas.</Alert>;
  }

  // ---------- Resultado ----------
  if (!answering && last) {
    return (
      <div className="grid gap-5">
        <ResultHeader quiz={quiz} attempt={last} />
        <AttemptReview attempt={last} />
        <div className="flex flex-wrap items-center gap-2">
          {quiz.can_attempt && (
            <button type="button" onClick={() => setAnswering(true)} className={buttonVariants.primary}>
              <RotateCcw size={16} aria-hidden /> Tentar de novo
            </button>
          )}
          {quiz.approved && nextHref && (
            <Link href={nextHref} className={buttonVariants.primary}>
              Próximo →
            </Link>
          )}
          {!quiz.can_attempt && !quiz.approved && !quiz.pending && (
            <p className="text-[13.5px] text-muted">Você usou todas as tentativas. Fale com o seu gestor.</p>
          )}
        </div>
      </div>
    );
  }

  // ---------- Prova ----------
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-sunken/60 px-4 py-3 text-[13px] text-muted">
        <span className="font-medium text-ink">
          {quiz.questions.length} {quiz.questions.length === 1 ? "pergunta" : "perguntas"} · {total} {total === 1 ? "ponto" : "pontos"}
        </span>
        <span>Nota mínima: {quiz.passing_score}%</span>
        <span>
          {quiz.max_attempts ? `Tentativa ${Math.min(attemptNo, quiz.max_attempts)} de ${quiz.max_attempts}` : `Tentativa ${attemptNo} · ilimitadas`}
        </span>
        {quiz.best_score !== null && <span>Sua melhor nota: {pct(quiz.best_score)}</span>}
      </div>
      {preview && <Alert tone="brand">Pré-visualização: dá para marcar as respostas, mas elas não são enviadas.</Alert>}

      <ol className="grid gap-4">
        {quiz.questions.map((q, i) => {
          const a = answers[q.id];
          return (
            <li key={q.id} className="grid gap-3 rounded-xl border border-line p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-accent">
                  Pergunta {i + 1} · {QUESTION_KIND_LABEL[q.kind]}
                </p>
                <span className="text-[12px] text-muted">
                  {q.points} {q.points === 1 ? "ponto" : "pontos"}
                </span>
              </div>
              <p className="whitespace-pre-line text-[15px] font-medium text-heading">{q.prompt}</p>
              {q.kind === "multipla" && <p className="-mt-1 text-[12.5px] text-muted">Marque todas as corretas.</p>}
              {q.kind === "aberta" ? (
                <textarea
                  rows={5}
                  value={a?.text ?? ""}
                  onChange={(e) => set(q.id, { text: e.target.value })}
                  maxLength={5000}
                  aria-label={`Resposta da pergunta ${i + 1}`}
                  placeholder="Escreva a sua resposta"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              ) : (
                <div className={cx("grid gap-2", q.kind === "vf" && "sm:grid-cols-2")} role={q.kind === "multipla" ? "group" : "radiogroup"} aria-label={`Pergunta ${i + 1}`}>
                  {q.options.map((o) => {
                    const on = a?.options?.includes(o.id) ?? false;
                    return (
                      <label
                        key={o.id}
                        className={cx(
                          "flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-[14px] transition-colors",
                          on ? "border-brand bg-accent-soft text-heading" : "border-line hover:bg-sunken/60",
                        )}
                      >
                        <input
                          type={q.kind === "multipla" ? "checkbox" : "radio"}
                          name={`q-${q.id}`}
                          checked={on}
                          onChange={(e) =>
                            set(q.id, {
                              options:
                                q.kind === "multipla"
                                  ? e.target.checked
                                    ? [...(a?.options ?? []), o.id]
                                    : (a?.options ?? []).filter((x) => x !== o.id)
                                  : [o.id],
                            })
                          }
                          className="h-4 w-4 shrink-0 accent-[rgb(var(--brand))]"
                        />
                        {o.label}
                      </label>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {error && <Alert>{error}</Alert>}
      {confirmMissing && missing > 0 && (
        <Alert tone="warn">
          {missing === 1 ? "1 pergunta está sem resposta" : `${missing} perguntas estão sem resposta`} e {missing === 1 ? "contará" : "contarão"} como erro. Clique em Enviar de novo
          para confirmar.
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={send} disabled={preview || pending} className={buttonVariants.primary}>
          <Send size={16} aria-hidden /> {pending ? "Enviando…" : "Enviar respostas"}
        </button>
        {last && !preview && (
          <button type="button" onClick={() => setAnswering(false)} className={buttonVariants.ghost}>
            Ver o último resultado
          </button>
        )}
        <span className="text-[12.5px] text-muted">
          {quiz.questions.length - missing} de {quiz.questions.length} respondidas
        </span>
      </div>
    </div>
  );
}

function ResultHeader({ quiz, attempt }: { quiz: LearnerQuiz; attempt: LearnerAttempt }) {
  const tone = attempt.status === "aprovada" ? "ok" : attempt.status === "em_correcao" ? "brand" : "danger";
  const Icon = attempt.status === "aprovada" ? Trophy : attempt.status === "em_correcao" ? Hourglass : CircleX;
  const box = {
    ok: "border-ok/30 bg-ok-soft",
    brand: "border-accent/30 bg-accent-soft",
    danger: "border-danger/30 bg-danger-soft",
  }[tone];
  return (
    <div className={cx("flex flex-wrap items-center gap-4 rounded-xl border px-5 py-4", box)}>
      <span className={cx("grid h-12 w-12 place-items-center rounded-full bg-surface", tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : "text-accent")}>
        <Icon size={24} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-semibold text-heading">
          {attempt.status === "em_correcao"
            ? "Respostas enviadas: aguardando a correção do gestor"
            : attempt.status === "aprovada"
              ? `Aprovado com ${pct(attempt.score)}`
              : `Você fez ${pct(attempt.score)}; a nota mínima é ${quiz.passing_score}%`}
        </p>
        <p className="text-[13px] text-muted">
          {attempt.status === "em_correcao"
            ? `Nota das questões objetivas até agora: ${pct(attempt.score)}. O resultado final sai depois da correção das respostas abertas.`
            : `${quiz.attempts_used} ${quiz.attempts_used === 1 ? "tentativa" : "tentativas"}${quiz.max_attempts ? ` de ${quiz.max_attempts}` : ""} · melhor nota ${pct(quiz.best_score)}`}
        </p>
      </div>
      <Badge tag={attempt.status === "aprovada" ? "avaliacao.aprovado" : attempt.status === "em_correcao" ? "avaliacao.aguardando_resultado" : "avaliacao.nao_atingiu"}>{ATTEMPT_LABEL[attempt.status]}</Badge>
      {attempt.feedback && (
        <div className="basis-full rounded-lg bg-surface/80 px-4 py-3 text-[13.5px]">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted">
            <MessageSquareText size={14} aria-hidden /> Comentário do gestor
          </p>
          <p className="mt-1 whitespace-pre-line">{attempt.feedback}</p>
        </div>
      )}
    </div>
  );
}

/** Revisão pergunta a pergunta. A alternativa correta só aparece depois de aprovado. */
function AttemptReview({ attempt }: { attempt: LearnerAttempt }) {
  return (
    <ol className="grid gap-3">
      {attempt.questions.map((q, i) => {
        const state = q.correct === null ? "pendente" : q.correct ? "certa" : q.kind === "aberta" && Number(q.awarded) > 0 ? "parcial" : "errada";
        return (
          <li key={q.question_id ?? i} className="grid gap-2 rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 flex-1 text-[14.5px] font-medium text-heading">
                <span className="mr-1.5 text-muted">{i + 1}.</span>
                {q.prompt}
              </p>
              {state === "certa" && <Badge tag="pergunta.certa">Certa · {q.awarded}/{q.points}</Badge>}
              {state === "parcial" && <Badge tag="pergunta.parcial">Parcial · {q.awarded}/{q.points}</Badge>}
              {state === "errada" && <Badge tag="pergunta.errada">Errada · 0/{q.points}</Badge>}
              {state === "pendente" && (
                <Badge tag="pergunta.em_correcao">
                  Em correção
                </Badge>
              )}
            </div>
            {q.kind === "aberta" ? (
              <p className="whitespace-pre-line rounded-lg bg-sunken/60 px-3 py-2 text-[13.5px]">{q.text || <em className="text-muted">Sem resposta</em>}</p>
            ) : (
              <ul className="grid gap-1.5">
                {q.options.map((o) => (
                  <li
                    key={o.id}
                    className={cx(
                      "flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13.5px]",
                      o.correct === true ? "bg-ok-soft text-ok" : o.selected ? "bg-sunken" : "text-muted",
                    )}
                  >
                    {o.correct === true ? <CheckCircle2 size={15} aria-hidden /> : o.selected ? <Check size={15} aria-hidden /> : <span className="w-[15px]" />}
                    {o.label}
                    {o.selected && <span className="ml-auto text-[11.5px] font-medium">sua resposta</span>}
                  </li>
                ))}
              </ul>
            )}
            {q.comment && <p className="text-[13px]"><strong>Comentário:</strong> {q.comment}</p>}
            {q.explanation && <p className="text-[13px] text-muted"><strong className="text-ink">Explicação:</strong> {q.explanation}</p>}
          </li>
        );
      })}
    </ol>
  );
}
