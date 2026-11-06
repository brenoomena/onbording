import { CheckCircle2, ClipboardCheck, CircleX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, FormBar, SubmitButton } from "@/components/forms";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  PageHeader,
  Textarea,
  buttonVariants,
  cx,
  formatDateTime,
} from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { QUESTION_KIND_LABEL, type QuestionKind } from "@/lib/quiz";
import { createClient } from "@/lib/supabase/server";
import { corrigirAvaliacao } from "../../actions";

export const metadata: Metadata = { title: "Corrigir avaliação" };

interface Item {
  question_id: string;
  kind: QuestionKind;
  prompt: string;
  explanation: string | null;
  points: number;
  options: { id: string; label: string; correct: boolean; selected: boolean }[];
  text: string | null;
  awarded: number | null;
  correct: boolean | null;
  comment: string | null;
}

/** Correção das respostas abertas: nota por resposta, comentário e parecer final. */
export default async function CorrecaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission(P.avaliacoesCorrigir);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase
    .from("quiz_attempts")
    .select(
      "id, status, score, points_total, passing_score, submitted_at, feedback, answers, profile:profiles!quiz_attempts_profile_id_fkey(full_name, email), content:contents(id, title)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const a = data as unknown as {
    id: string;
    status: string;
    score: number;
    points_total: number;
    passing_score: number;
    submitted_at: string;
    feedback: string | null;
    answers: Item[];
    profile: { full_name: string; email: string };
    content: { id: string; title: string };
  };
  const open = a.answers.filter((x) => x.kind === "aberta");
  const auto = a.answers
    .filter((x) => x.kind !== "aberta")
    .reduce((s, x) => s + Number(x.awarded ?? 0), 0);
  const pending = a.status === "em_correcao";

  return (
    <>
      <PageHeader
        eyebrow="Correções"
        icon={ClipboardCheck}
        title={a.content.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {a.profile.full_name} · enviada em {formatDateTime(a.submitted_at)}
            <Badge
              tag={
                pending ? "correcao.aguardando" : a.status === "aprovada" ? "correcao.aprovada" : "correcao.reprovada"
              }
            >
              {pending
                ? "Aguardando correção"
                : a.status === "aprovada"
                  ? "Aprovada"
                  : "Reprovada"}
            </Badge>
          </span>
        }
      />
      {!pending && (
        <Alert tone="brand">
          Esta tentativa já foi corrigida (nota final{" "}
          {Math.round(Number(a.score))}%).{" "}
          <Link
            href="/acompanhamento?vista=correcoes"
            className="font-medium underline"
          >
            Voltar às correções
          </Link>
        </Alert>
      )}
      <ActionForm action={corrigirAvaliacao}>
        <>
          {pending && (
            <FormBar
              info={
                <>
                  Objetivas: {auto} de {a.points_total} pontos · nota mínima{" "}
                  {a.passing_score}%
                </>
              }
            >
              <SubmitButton pendingLabel="Salvando…">
                Concluir correção
              </SubmitButton>
            </FormBar>
          )}
          <input type="hidden" name="attempt_id" value={a.id} />
          <ol className="grid gap-3">
            {a.answers.map((x, i) => (
              <li key={x.question_id ?? i}>
                <Card>
                  <div className="grid gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-accent">
                          Pergunta {i + 1} · {QUESTION_KIND_LABEL[x.kind]} ·{" "}
                          {x.points} {x.points === 1 ? "ponto" : "pontos"}
                        </p>
                        <p className="mt-1 whitespace-pre-line text-[15px] font-medium text-heading">
                          {x.prompt}
                        </p>
                      </div>
                      {x.kind !== "aberta" &&
                        (x.correct ? (
                          <Badge tag="pergunta.certa">
                            Certa
                          </Badge>
                        ) : (
                          <Badge tag="pergunta.errada">
                            Errada
                          </Badge>
                        ))}
                    </div>
                    {x.kind === "aberta" ? (
                      <>
                        <div className="whitespace-pre-line rounded-lg bg-sunken/60 px-3 py-2.5 text-[14px]">
                          {x.text || (
                            <em className="text-muted">Sem resposta</em>
                          )}
                        </div>
                        {pending ? (
                          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                            <Field
                              label={`Nota (0 a ${x.points})`}
                              htmlFor={`pts_${x.question_id}`}
                            >
                              <Input
                                id={`pts_${x.question_id}`}
                                name={`pts_${x.question_id}`}
                                type="number"
                                min={0}
                                max={x.points}
                                step={0.5}
                                required
                              />
                            </Field>
                            <Field
                              label="Comentário para a pessoa (opcional)"
                              htmlFor={`com_${x.question_id}`}
                            >
                              <Input
                                id={`com_${x.question_id}`}
                                name={`com_${x.question_id}`}
                                maxLength={1000}
                              />
                            </Field>
                          </div>
                        ) : (
                          <p className="text-[13px]">
                            Nota: <strong>{x.awarded}</strong> de {x.points}
                            {x.comment && <> · {x.comment}</>}
                          </p>
                        )}
                      </>
                    ) : (
                      <ul className="grid gap-1.5">
                        {x.options.map((o) => (
                          <li
                            key={o.id}
                            className={cx(
                              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13.5px]",
                              o.correct
                                ? "bg-ok-soft text-ok"
                                : o.selected
                                  ? "bg-danger-soft text-danger"
                                  : "text-muted",
                            )}
                          >
                            {o.correct ? (
                              <CheckCircle2 size={15} aria-hidden />
                            ) : (
                              <span className="w-[15px]" />
                            )}
                            {o.label}
                            {o.selected && (
                              <span className="ml-auto text-[11.5px] font-medium">
                                resposta da pessoa
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ol>
          {pending && open.length > 0 && (
            <Card title="Parecer final (opcional)">
              <Textarea
                name="feedback"
                rows={3}
                maxLength={2000}
                placeholder="Aparece para a pessoa junto com o resultado."
                aria-label="Parecer final"
              />
            </Card>
          )}
          {!pending && a.feedback && (
            <Card title="Parecer final">{a.feedback}</Card>
          )}
          {!pending && (
            <Link
              href="/acompanhamento?vista=correcoes"
              className={cx(buttonVariants.secondary, "w-fit")}
            >
              Voltar às correções
            </Link>
          )}
        </>
      </ActionForm>
    </>
  );
}
