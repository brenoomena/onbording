import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, ActionForm, SubmitButton, PageNotice } from "@/components/forms";
import { Alert, Badge, Card, Field, Input, PageHeader, Select, buttonVariants } from "@/components/ui";
import { RichTextarea } from "@/components/rich-textarea";
import { requirePermission } from "@/lib/auth";
import { KIND_LABEL, PUBLISH_LABEL, type AudienceRule } from "@/lib/learning";
import { P } from "@/lib/permissions";
import { loadStructure } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import {
  addItem,
  addModule,
  deleteModule,
  deleteTrack,
  moveItem,
  moveModule,
  removeItem,
  saveTrack,
  setTrackStatus,
  toggleRequired,
  updateModule,
} from "../actions";
import { TrackForm } from "../track-form";
import { loadTrack } from "./load";

export const metadata: Metadata = { title: "Trilha" };

const tone = { rascunho: "warn", publicado: "ok", arquivado: "neutral" } as const;

export default async function TrilhaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  await requirePermission(P.trilhasGerenciar);
  const { id } = await params;
  const { aviso } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const loaded = await loadTrack(id);
  if (!loaded) notFound();
  const { track, modules } = loaded;

  const supabase = await createClient();
  const [{ data: rules }, { data: contents }, { count: enrolled }, structure] = await Promise.all([
    supabase.from("audience_rules").select("area_id, position_id, level_id").eq("track_id", id),
    supabase.from("contents").select("id, title, status, kind").neq("status", "arquivado").order("title"),
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("track_id", id),
    loadStructure(),
  ]);
  const options = (contents ?? []) as { id: string; title: string; status: string; kind: keyof typeof KIND_LABEL }[];
  const totalItems = modules.reduce((s, m) => s + m.items.length, 0);
  const drafts = modules.flatMap((m) => m.items).filter((i) => i.content.status !== "publicado");

  return (
    <>
      <PageHeader
        eyebrow="Trilhas"
        title={track.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={tone[track.status]}>{PUBLISH_LABEL[track.status]}</Badge>
            {track.is_mandatory && <Badge tone="brand">Obrigatória</Badge>}
            <span>
              {modules.length} módulos · {totalItems} conteúdos · {enrolled ?? 0} matrículas
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-start gap-2">
            <Link href={`/trilhas/${id}/matriculas`} className={buttonVariants.secondary}>Matrículas e progresso</Link>
            {track.status !== "publicado" && (
              <ActionButton action={setTrackStatus} hidden={{ id, status: "publicado" }} label="Publicar" variant="primary" />
            )}
            {track.status === "publicado" && (
              <ActionButton action={setTrackStatus} hidden={{ id, status: "rascunho" }} label="Voltar para rascunho" confirm confirmLabel="Despublicar" confirmText="A trilha some para os colaboradores até ser publicada de novo." />
            )}
            {track.status !== "arquivado" && (
              <ActionButton action={setTrackStatus} hidden={{ id, status: "arquivado" }} label="Arquivar" confirm confirmLabel="Arquivar trilha" confirmText="A trilha sai das listas e para de receber matrículas automáticas." />
            )}
            {!enrolled && <ActionButton action={deleteTrack} hidden={{ id }} label="Excluir" variant="danger" confirm confirmLabel="Excluir trilha" confirmText="A trilha e os módulos serão apagados definitivamente. Os conteúdos continuam cadastrados." />}
          </div>
        }
      />
      {aviso === "criada" && <PageNotice message="Trilha criada como rascunho. Monte os módulos abaixo e publique quando estiver pronta." />}
      {track.status === "publicado" && drafts.length > 0 && (
        <Alert tone="warn">
          {drafts.length} {drafts.length === 1 ? "conteúdo desta trilha está" : "conteúdos desta trilha estão"} em rascunho e não aparece
          {drafts.length === 1 ? "" : "m"} para os colaboradores: {drafts.map((d) => d.content.title).join(", ")}.
        </Alert>
      )}

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Estrutura</h2>
        {modules.length === 0 && <p className="text-[13px] text-muted">Nenhum módulo ainda. Crie o primeiro abaixo.</p>}
        {modules.map((m, mi) => (
          <div key={m.id} className="rounded-xl border border-line bg-surface">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent">Módulo {mi + 1}</p>
                <p className="font-semibold">{m.title}</p>
                {m.description && <Markdown size="sm" className="text-muted">{m.description}</Markdown>}
              </div>
              <div className="flex flex-wrap items-start gap-1">
                {mi > 0 && <ActionButton action={moveModule} hidden={{ id: m.id, direction: "-1", track_id: id }} label="↑" variant="ghost" pendingLabel="…" />}
                {mi < modules.length - 1 && (
                  <ActionButton action={moveModule} hidden={{ id: m.id, direction: "1", track_id: id }} label="↓" variant="ghost" pendingLabel="…" />
                )}
                <details className="relative">
                  <summary className={`${buttonVariants.ghost} cursor-pointer list-none py-1.5 text-[13px] [&::-webkit-details-marker]:hidden`}>Editar</summary>
                  <div className="absolute right-0 z-10 mt-1 w-[min(90vw,360px)] rounded-xl border border-line bg-surface p-4 shadow-lg">
                    <ActionForm action={updateModule}>
                      <input type="hidden" name="id" value={m.id} />
                      <Field label="Nome do módulo" htmlFor={`mt-${m.id}`}>
                        <Input id={`mt-${m.id}`} name="title" defaultValue={m.title} required />
                      </Field>
                      <Field label="Descrição" htmlFor={`md-${m.id}`}>
                        <RichTextarea id={`md-${m.id}`} name="description" rows={2} defaultValue={m.description ?? ""} maxLength={1000} />
                      </Field>
                      <div className="flex items-center justify-between gap-2">
                        <SubmitButton className="py-1.5 text-[13px]">Salvar</SubmitButton>
                      </div>
                    </ActionForm>
                    <div className="mt-3 border-t border-line pt-3">
                      <ActionButton action={deleteModule} hidden={{ id: m.id }} label="Excluir módulo" variant="danger" confirm confirmLabel="Excluir" />
                    </div>
                  </div>
                </details>
              </div>
            </div>

            <ol className="divide-y divide-line">
              {m.items.map((it, ii) => (
                <li key={it.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-5 shrink-0 text-right font-mono text-[12px] text-muted">{ii + 1}</span>
                    <div className="min-w-0">
                      <Link href={`/conteudos/${it.content.id}`} className="text-[14px] font-medium hover:text-accent">{it.content.title}</Link>
                      <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                        {KIND_LABEL[it.content.kind]}
                        {it.content.external_platform && ` · ${it.content.external_platform}`}
                        {it.content.status !== "publicado" && <Badge tone="warn">{PUBLISH_LABEL[it.content.status]}</Badge>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-start gap-1">
                    <ActionButton
                      action={toggleRequired}
                      hidden={{ id: it.id, value: String(!it.is_required), track_id: id }}
                      label={it.is_required ? "Obrigatório" : "Opcional"}
                      variant={it.is_required ? "secondary" : "ghost"}
                      pendingLabel="…"
                    />
                    {ii > 0 && <ActionButton action={moveItem} hidden={{ id: it.id, direction: "-1", track_id: id }} label="↑" variant="ghost" pendingLabel="…" />}
                    {ii < m.items.length - 1 && (
                      <ActionButton action={moveItem} hidden={{ id: it.id, direction: "1", track_id: id }} label="↓" variant="ghost" pendingLabel="…" />
                    )}
                    <ActionButton action={removeItem} hidden={{ id: it.id, track_id: id }} label="Remover" variant="ghost" confirm confirmLabel="Remover" />
                  </div>
                </li>
              ))}
            </ol>

            <div className="border-t border-line bg-bg/60 px-4 py-3">
              <ActionForm action={addItem} className="sm:grid-cols-[1fr_auto_auto] sm:items-end">
                <input type="hidden" name="module_id" value={m.id} />
                <input type="hidden" name="track_id" value={id} />
                <div className="grid gap-1">
                  <label htmlFor={`add-${m.id}`} className="text-[12px] font-medium text-muted">Incluir conteúdo</label>
                  <Select id={`add-${m.id}`} name="content_id" defaultValue="">
                    <option value="" disabled>Escolha um conteúdo</option>
                    {options
                      .filter((o) => !m.items.some((i) => i.content.id === o.id))
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.title}
                          {o.status !== "publicado" ? " (rascunho)" : ""}
                        </option>
                      ))}
                  </Select>
                </div>
                <label className="flex items-center gap-2 pb-2 text-[13px]">
                  <input type="checkbox" name="is_required" defaultChecked className="h-4 w-4 accent-[rgb(var(--brand))]" /> Obrigatório
                </label>
                <SubmitButton variant="secondary" className="py-2 text-[13px]">Incluir</SubmitButton>
              </ActionForm>
              <p className="mt-2 text-[12px] text-muted">
                Não encontrou? <Link href="/conteudos/novo" className="font-medium text-accent hover:underline">Cadastre um conteúdo novo</Link>.
              </p>
            </div>
          </div>
        ))}

        <Card title="Novo módulo">
          <ActionForm action={addModule} resetOnSuccess className="sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <input type="hidden" name="track_id" value={id} />
            <Field label="Nome" htmlFor="new-mod-title">
              <Input id="new-mod-title" name="title" required minLength={2} maxLength={120} />
            </Field>
            <Field label="Descrição (opcional)" htmlFor="new-mod-desc">
              <Input id="new-mod-desc" name="description" maxLength={400} />
            </Field>
            <SubmitButton variant="secondary">Criar módulo</SubmitButton>
          </ActionForm>
        </Card>
      </section>

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Dados e público</h2>
        <Card>
          <TrackForm action={saveTrack} track={track} rules={(rules ?? []) as AudienceRule[]} structure={structure} />
        </Card>
      </section>
    </>
  );
}
