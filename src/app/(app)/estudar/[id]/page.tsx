import { ClipboardCheck, FileText, Lock } from "lucide-react";
import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ContentViewer, ObjectiveHint, ObjectiveNote } from "@/components/content-viewer";
import { StudyTracker } from "@/components/study-tracker";
import { QuizRunner } from "@/components/quiz-runner";
import type { LearnerQuiz } from "@/lib/quiz";
import { Alert, Badge, PageHeader, buttonVariants, formatDate, KIND_TONE } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { KIND_LABEL, formatMinutes, itemStates, type ContentRow } from "@/lib/learning";
import { loadProgressOf } from "@/lib/my-learning";
import { createClient } from "@/lib/supabase/server";
import { loadTrack } from "../../trilhas/[id]/load";
import { completeContent } from "../actions";
import { KIND_TAG } from "@/lib/tags";
import { FeedbackForm } from "../../pesquisa/feedback-form";

export const metadata: Metadata = { title: "Estudar" };

export default async function EstudarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ trilha?: string; previa?: string }>;
}) {
  const me = await requireUser();
  const { id } = await params;
  const { trilha, previa } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("contents").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const content = data as ContentRow;
  const preview = previa === "1";

  const progress = await loadProgressOf(me.userId);
  const mine = progress.byContent.get(id);
  const done = mine?.status === "concluido";
  const myFeedback =
    done && !preview
      ? (await supabase.from("content_feedback").select("rating, comment, anonymous").eq("profile_id", me.userId).eq("content_id", id).maybeSingle()).data
      : null;

  // Contexto da trilha: anterior, próximo e bloqueio sequencial.
  let nav: { prev?: string; next?: string; locked: boolean; trackName?: string; trackId?: string } = { locked: false };
  if (trilha && /^[0-9a-f-]{36}$/i.test(trilha)) {
    const loaded = await loadTrack(trilha);
    if (loaded) {
      const mods = loaded.modules.map((m) => ({ ...m, items: m.items.filter((i) => i.content.status === "publicado") }));
      const flat = mods.flatMap((m) => m.items);
      const idx = flat.findIndex((i) => i.content.id === id);
      const states = itemStates(mods, progress.completed, loaded.track.is_sequential);
      if (idx >= 0) {
        nav = {
          prev: flat[idx - 1]?.content.id,
          next: flat[idx + 1]?.content.id,
          locked: states.get(flat[idx].id) === "bloqueado",
          trackName: loaded.track.name,
          trackId: trilha,
        };
      }
    }
  }

  let fileUrl: string | null = null;
  if (content.kind === "arquivo" && content.storage_path) {
    const { data: signed } = await supabase.storage.from("conteudos").createSignedUrl(content.storage_path, 3600);
    fileUrl = signed?.signedUrl ?? null;
  }
  const q = nav.trackId ? `?trilha=${nav.trackId}` : "";

  // Avaliação: prova e situação vêm do banco, sem gabarito.
  const isQuiz = content.kind === "avaliacao";
  let quiz: LearnerQuiz | null = null;
  let quizError: string | null = null;
  if (isQuiz && !(nav.locked && !preview)) {
    const { data: qz, error: qe } = await supabase.rpc("get_quiz", { p_content: id });
    if (qe) quizError = qe.message;
    else quiz = qz as LearnerQuiz;
  }

  if (nav.locked && !preview) {
    return (
      <>
        <PageHeader eyebrow={nav.trackName} icon={Lock} title={content.title} />
        <Alert tone="warn">Esta etapa é liberada quando você concluir as etapas obrigatórias anteriores da trilha.</Alert>
        <Link href={`/minhas-trilhas/${nav.trackId}`} className={buttonVariants.secondary + " w-fit"}>Voltar à trilha</Link>
      </>
    );
  }

  return (
    <>
      {!preview && <StudyTracker contentId={id} />}
      {/* Cabeçalho compacto: título, etiquetas e a ação de concluir numa faixa só, para o conteúdo ganhar espaço. */}
      <header className="sticky top-[68px] z-10 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-xl border border-line bg-surface/95 px-3.5 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.05)] backdrop-blur sm:px-4">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-icon-bg text-icon">
          {isQuiz ? <ClipboardCheck size={18} strokeWidth={1.9} /> : <FileText size={18} strokeWidth={1.9} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1 text-[11.5px] font-medium text-muted">
            {nav.trackId ? (
              <Link href={`/minhas-trilhas/${nav.trackId}`} className="truncate hover:text-accent hover:underline">{nav.trackName}</Link>
            ) : (
              <span className="truncate">{content.category ?? "Conteúdo"}</span>
            )}
          </p>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="min-w-0 truncate text-[17px] font-semibold leading-snug tracking-tight sm:text-[18px]">{content.title}</h1>
            <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
              <Badge tag={KIND_TAG[content.kind]}>{KIND_LABEL[content.kind]}</Badge>
              {content.external_platform && <span>{content.external_platform}</span>}
              {content.estimated_minutes && <span>· cerca de {content.estimated_minutes} min</span>}
              <span className="hidden md:inline">
                · {mine ? `${mine.active_seconds > 0 ? `${formatMinutes(mine.active_seconds)} de estudo · ` : ""}${mine.visits} ${mine.visits === 1 ? "acesso" : "acessos"}` : "primeiro acesso"}
              </span>
            </span>
          </div>
        </div>
        {!preview && isQuiz && quiz && !done && (
          <Badge tag={quiz.pending ? "avaliacao.aguardando_topo" : "avaliacao.nota_minima"}>{quiz.pending ? "Aguardando correção" : `Nota mínima ${quiz.passing_score}%`}</Badge>
        )}
        {!preview &&
          (done ? (
            <span className="flex items-center gap-2">
              <Badge tag="estudo.concluido">Concluído em {formatDate(mine?.completed_at)}</Badge>
              {nav.next && <Link href={`/estudar/${nav.next}${q}`} className={buttonVariants.primary}>Próximo →</Link>}
            </span>
          ) : isQuiz ? null : (
            <ActionForm action={completeContent}>
              <input type="hidden" name="content_id" value={id} />
              <input type="hidden" name="mode" value={content.kind === "link" ? "externa_declarada" : "confirmada"} />
              <SubmitButton pendingLabel="Registrando…">
                {content.kind === "link" ? `Já concluí ${content.external_platform ? `no ${content.external_platform}` : "este conteúdo"}` : "Marcar como concluído"}
              </SubmitButton>
            </ActionForm>
          ))}
      </header>
      {preview && <Alert tone="brand">Pré-visualização: o seu tempo e a conclusão não são registrados.</Alert>}
      {content.description && <Markdown>{content.description}</Markdown>}
      {/* Na avaliação, as orientações vêm antes das perguntas. */}
      {isQuiz && content.objective && <ObjectiveNote id="objetivo" text={content.objective} />}

      <article className="rounded-xl border border-line bg-surface p-5 sm:p-7">
        {isQuiz ? (
          quiz ? (
            <QuizRunner contentId={id} quiz={quiz} preview={preview} nextHref={nav.next ? `/estudar/${nav.next}${q}` : undefined} />
          ) : (
            <Alert>{quizError ?? "Não foi possível abrir a avaliação."}</Alert>
          )
        ) : (
          <ContentViewer content={content} fileUrl={fileUrl} />
        )}
        {content.kind === "link" && (
          <p className="mt-4 text-[13px] text-muted">Quando terminar, volte aqui e marque como concluído no botão acima.</p>
        )}
      </article>

      {!isQuiz && content.objective && (
        <>
          <ObjectiveHint targetId="objetivo" />
          <ObjectiveNote id="objetivo" text={content.objective} />
        </>
      )}

      {done && !preview && (
        <FeedbackForm key={JSON.stringify(myFeedback)} target="conteudo" id={id} name={content.title} mine={myFeedback ?? null} />
      )}

      {nav.trackId && (
        <nav aria-label="Navegação da trilha" className="flex flex-wrap items-center justify-between gap-2">
          {nav.prev ? <Link href={`/estudar/${nav.prev}${q}`} className={buttonVariants.secondary}>← Anterior</Link> : <span />}
          <Link href={`/minhas-trilhas/${nav.trackId}`} className="text-[13px] font-medium text-accent hover:underline">Ver a trilha</Link>
          {nav.next ? <Link href={`/estudar/${nav.next}${q}`} className={buttonVariants.primary}>Próximo →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
