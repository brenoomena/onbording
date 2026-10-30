import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProgressBar } from "@/components/progress-bar";
import { Badge, EmptyState, PageHeader, cx, formatDate } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ENROLLMENT_LABEL, KIND_LABEL, isOverdue, itemStates } from "@/lib/learning";
import { loadEnrollmentsOf, loadProgressOf } from "@/lib/my-learning";
import { loadTrack } from "../../trilhas/[id]/load";

export const metadata: Metadata = { title: "Trilha" };

function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

export default async function MinhaTrilhaPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [loaded, enrollments, progress] = await Promise.all([loadTrack(id), loadEnrollmentsOf(me.userId), loadProgressOf(me.userId)]);
  if (!loaded) notFound();
  const { track } = loaded;
  // Colaboradores só veem conteúdos publicados; gestores veem tudo, mas aqui mostramos a visão de quem estuda.
  const modules = loaded.modules
    .map((m) => ({ ...m, items: m.items.filter((i) => i.content.status === "publicado") }))
    .filter((m) => m.items.length > 0);
  const enrollment = enrollments.find((e) => e.track.id === id);
  const states = itemStates(modules, progress.completed, track.is_sequential);
  const next = modules.flatMap((m) => m.items).find((i) => states.get(i.id) === "liberado");

  return (
    <>
      <PageHeader
        eyebrow="Minhas trilhas"
        title={track.name}
        actions={
          next && (
            <Link href={`/estudar/${next.content.id}?trilha=${id}`} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-on-brand hover:bg-brand/85">
              {enrollment?.status === "nao_iniciada" ? "Começar" : "Continuar"}
            </Link>
          )
        }
      />
      {track.description && <Markdown size="sm">{track.description}</Markdown>}
      {enrollment ? (
        <div className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <ProgressBar value={Number(enrollment.progress_percent)} label="Seu progresso" />
          <div className="flex flex-wrap gap-2 text-[13px]">
            <Badge tone={isOverdue(enrollment.due_date, enrollment.status) ? "danger" : enrollment.status === "concluida" ? "ok" : "neutral"}>
              {isOverdue(enrollment.due_date, enrollment.status) ? "Em atraso" : ENROLLMENT_LABEL[enrollment.status]}
            </Badge>
            {enrollment.due_date && <span className="text-muted">Prazo {formatDate(enrollment.due_date)}</span>}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-line bg-sunken px-4 py-2.5 text-[13px] text-muted">Você não está matriculado nesta trilha. O progresso não é registrado.</p>
      )}
      {track.objective && (
        <section className="rounded-xl border border-accent/30 bg-accent-soft/50 px-4 py-3">
          <h2 className="mb-1 text-[13px] font-semibold">Objetivo</h2>
          <Markdown size="sm">{track.objective}</Markdown>
        </section>
      )}

      {modules.length === 0 ? (
        <EmptyState title="Esta trilha ainda não tem conteúdos publicados" />
      ) : (
        <ol className="grid gap-4">
          {modules.map((m, mi) => {
            const req = m.items.filter((i) => i.is_required);
            const doneReq = req.filter((i) => progress.completed.has(i.content.id)).length;
            return (
              <li key={m.id} className="rounded-xl border border-line bg-surface">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent">Módulo {mi + 1}</p>
                    <p className="font-semibold">{m.title}</p>
                    {m.description && <Markdown size="sm" className="text-muted">{m.description}</Markdown>}
                  </div>
                  {req.length > 0 && <span className="text-[12.5px] tabular-nums text-muted">{doneReq} de {req.length} obrigatórios</span>}
                </div>
                <ol className="divide-y divide-line">
                  {m.items.map((it) => {
                    const st = states.get(it.id);
                    const inner = (
                      <>
                        <span
                          aria-hidden
                          className={cx(
                            "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[12px] font-bold",
                            st === "concluido" ? "border-ok bg-ok text-surface" : st === "bloqueado" ? "border-line text-muted" : "border-brand text-accent",
                          )}
                        >
                          {st === "concluido" ? "✓" : st === "bloqueado" ? <LockIcon /> : ""}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cx("block text-[14px] font-medium", st === "bloqueado" && "text-muted")}>{it.content.title}</span>
                          <span className="block text-[12px] text-muted">
                            {KIND_LABEL[it.content.kind]}
                            {it.content.external_platform && ` · ${it.content.external_platform}`}
                            {it.content.estimated_minutes && ` · ${it.content.estimated_minutes} min`}
                            {!it.is_required && " · Opcional"}
                          </span>
                        </span>
                        <span className="sr-only">{st === "concluido" ? "Concluído" : st === "bloqueado" ? "Bloqueado" : "Disponível"}</span>
                      </>
                    );
                    return (
                      <li key={it.id}>
                        {st === "bloqueado" ? (
                          <div className="flex items-center gap-3 px-4 py-3" title="Conclua as etapas anteriores para liberar">{inner}</div>
                        ) : (
                          <Link href={`/estudar/${it.content.id}?trilha=${id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-accent-soft/40">
                            {inner}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })}
        </ol>
      )}
      <Link href="/minhas-trilhas" className="text-[13px] font-medium text-accent hover:underline">← Minhas trilhas</Link>
    </>
  );
}
