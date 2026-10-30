import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ContentViewer } from "@/components/content-viewer";
import { StudyTracker } from "@/components/study-tracker";
import { Alert, Badge, PageHeader, buttonVariants, formatDate } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { KIND_LABEL, formatMinutes, itemStates, type ContentRow } from "@/lib/learning";
import { loadProgressOf } from "@/lib/my-learning";
import { createClient } from "@/lib/supabase/server";
import { loadTrack } from "../../trilhas/[id]/load";
import { completeContent } from "../actions";

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

  if (nav.locked && !preview) {
    return (
      <>
        <PageHeader eyebrow={nav.trackName} title={content.title} />
        <Alert tone="warn">Esta etapa é liberada quando você concluir as etapas obrigatórias anteriores da trilha.</Alert>
        <Link href={`/minhas-trilhas/${nav.trackId}`} className={buttonVariants.secondary + " w-fit"}>Voltar à trilha</Link>
      </>
    );
  }

  return (
    <>
      {!preview && <StudyTracker contentId={id} />}
      <PageHeader
        eyebrow={nav.trackName ?? content.category ?? "Conteúdo"}
        title={content.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{KIND_LABEL[content.kind]}</Badge>
            {content.external_platform && <span>{content.external_platform}</span>}
            {content.estimated_minutes && <span>· cerca de {content.estimated_minutes} min</span>}
            {done && <Badge tone="ok">Concluído em {formatDate(mine?.completed_at)}</Badge>}
          </span>
        }
      />
      {preview && <Alert tone="brand">Pré-visualização: o seu tempo e a conclusão não são registrados.</Alert>}
      {content.description && <p className="max-w-3xl text-[15px]">{content.description}</p>}
      {content.objective && (
        <p className="max-w-3xl text-[14px] text-muted"><span className="font-semibold text-ink">Objetivo:</span> {content.objective}</p>
      )}

      <article className="rounded-xl border border-line bg-surface p-5 sm:p-7">
        <ContentViewer content={content} fileUrl={fileUrl} />
        {content.kind === "link" && (
          <p className="mt-4 text-[13px] text-muted">Quando terminar, volte aqui e marque como concluído.</p>
        )}
      </article>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
        <div className="text-[13px] text-muted">
          {mine ? `Tempo ativo neste conteúdo: ${formatMinutes(mine.active_seconds)} · ${mine.visits} ${mine.visits === 1 ? "acesso" : "acessos"}` : "Primeiro acesso"}
        </div>
        {!preview &&
          (done ? (
            <Badge tone="ok">Concluído</Badge>
          ) : (
            <ActionForm action={completeContent}>
              <input type="hidden" name="content_id" value={id} />
              <input type="hidden" name="mode" value={content.kind === "link" ? "externa_declarada" : "confirmada"} />
              <SubmitButton pendingLabel="Registrando…">
                {content.kind === "link" ? `Já concluí ${content.external_platform ? `no ${content.external_platform}` : "este conteúdo"}` : "Marcar como concluído"}
              </SubmitButton>
            </ActionForm>
          ))}
      </div>

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
