import { ArrowDown, ArrowUp, ClipboardCheck, Eye, FilePlus2, Layers3, Plus, Route, Settings2, Trash2, Users, X } from "lucide-react";
import { Tabs, type TabDef } from "@/components/tabs";
import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, ActionForm, SubmitButton, PageNotice } from "@/components/forms";
import { Alert, Badge, Card, Field, Input, PageHeader, buttonVariants, PUBLISH_TONE, KIND_TONE } from "@/components/ui";
import { RichTextarea } from "@/components/rich-textarea";
import { can, requirePermission } from "@/lib/auth";
import { KIND_LABEL, PUBLISH_LABEL, type AudienceRule } from "@/lib/learning";
import { P } from "@/lib/permissions";
import { loadStructure } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { saveContent } from "../../conteudos/actions";
import { ContentForm } from "../../conteudos/content-form";
import { loadContentFormData } from "../../conteudos/form-data";
import {
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
import { ModulePicker, NewContentButton, NewModuleForm, PlaceContent } from "./track-parts";
import { NewQuizButton, NewQuizForm } from "./quiz-form";
import { KIND_TAG, PUBLISH_TAG } from "@/lib/tags";

export const metadata: Metadata = { title: "Trilha" };

const tone = PUBLISH_TONE;

export default async function TrilhaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string; aba?: string }> }) {
  const me = await requirePermission(P.trilhasVer);
  const canEdit = can(me, P.trilhasEditar);
  const { id } = await params;
  const { aviso, aba } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const loaded = await loadTrack(id);
  if (!loaded) notFound();
  const { track, modules } = loaded;

  const supabase = await createClient();
  const canCreateContent = can(me, P.conteudosCriar);
  const [{ data: rules }, { data: contents }, { count: enrolled }, structure, formData] = await Promise.all([
    supabase.from("audience_rules").select("area_id, position_id, level_id").eq("track_id", id),
    // Só os conteúdos que pertencem a esta trilha podem entrar nos módulos dela.
    supabase.from("contents").select("id, title, status, kind").eq("track_id", id).neq("status", "arquivado").order("title"),
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("track_id", id),
    loadStructure(),
    canCreateContent ? loadContentFormData() : Promise.resolve(null),
  ]);
  const moduleOptions = modules.map((m) => ({ id: m.id, title: m.title }));
  const options = (contents ?? []) as { id: string; title: string; status: string; kind: keyof typeof KIND_LABEL }[];
  const totalItems = modules.reduce((s, m) => s + m.items.length, 0);
  const drafts = modules.flatMap((m) => m.items).filter((i) => i.content.status !== "publicado");
  const placed = new Set(modules.flatMap((m) => m.items.map((i) => i.content.id)));
  const outside = options.filter((o) => !placed.has(o.id));

  return (
    <>
      <PageHeader
        eyebrow="Trilhas"
        icon={Route}
        title={track.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tag={PUBLISH_TAG[track.status]}>{PUBLISH_LABEL[track.status]}</Badge>
            {track.is_mandatory && <Badge tag="trilha.obrigatoria">Obrigatória</Badge>}
            <span>
              {modules.length} módulos · {totalItems} conteúdos · {enrolled ?? 0} matrículas
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-start gap-2">
            <Link href={`/trilhas/${id}/ver`} className={buttonVariants.secondary}>
              <Eye size={16} aria-hidden /> Ver como colaborador
            </Link>
            {can(me, P.trilhasMatricular) && (
              <Link href={`/trilhas/${id}/matriculas`} className={buttonVariants.secondary}>
                <Users size={16} aria-hidden /> Matrículas e progresso
              </Link>
            )}
            {canEdit && track.status !== "publicado" && (
              <ActionButton action={setTrackStatus} hidden={{ id, status: "publicado" }} label="Publicar" variant="primary" />
            )}
            {canEdit && track.status === "publicado" && (
              <ActionButton action={setTrackStatus} hidden={{ id, status: "rascunho" }} label="Voltar para rascunho" confirm confirmLabel="Despublicar" confirmText="A trilha some para os colaboradores até ser publicada de novo." />
            )}
            {canEdit && track.status !== "arquivado" && (
              <ActionButton action={setTrackStatus} hidden={{ id, status: "arquivado" }} label="Arquivar" confirm confirmLabel="Arquivar trilha" confirmText="A trilha sai das listas e para de receber matrículas automáticas." />
            )}
            {can(me, P.trilhasExcluir) && !enrolled && (
              <ActionButton action={deleteTrack} hidden={{ id, voltar: "1" }} label="Excluir" variant="danger" icon={<Trash2 size={15} aria-hidden />} confirm confirmLabel="Excluir trilha" confirmText="A trilha e os módulos serão apagados definitivamente. Só é possível sem conteúdos vinculados." />
            )}
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

      {!canEdit && <Alert tone="brand">Você pode consultar esta trilha. Para alterar, é preciso a permissão de editar trilhas.</Alert>}

      <Tabs
        label="Edição da trilha"
        initial={aba ?? (aviso === "criada" && canEdit ? "modulo" : "estrutura")}
        tabs={[
          {
            key: "estrutura",
            label: "Estrutura",
            icon: <Layers3 size={16} aria-hidden />,
            count: modules.length,
            content: (
              <>
                {modules.length === 0 && <p className="text-[13px] text-muted">Nenhum módulo ainda. Crie o primeiro na aba <strong>Novo módulo</strong>.</p>}
                {modules.map((m, mi) => (
                  <div key={m.id} className="rounded-xl border border-line bg-surface">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent">Módulo {mi + 1}</p>
                        <p className="font-semibold">{m.title}</p>
                        {m.description && <Markdown size="sm" className="text-muted">{m.description}</Markdown>}
                      </div>
                      {canEdit && <div className="flex flex-wrap items-start gap-1">
                        {mi > 0 && <ActionButton action={moveModule} hidden={{ id: m.id, direction: "-1", track_id: id }} label="Subir módulo" icon={<ArrowUp size={16} aria-hidden />} iconOnly />}
                        {mi < modules.length - 1 && (
                          <ActionButton action={moveModule} hidden={{ id: m.id, direction: "1", track_id: id }} label="Descer módulo" icon={<ArrowDown size={16} aria-hidden />} iconOnly />
                        )}
                        <details className="relative">
                          <summary className={`${buttonVariants.ghost} cursor-pointer list-none py-1.5 text-[13px] [&::-webkit-details-marker]:hidden`}><Settings2 size={15} aria-hidden /> Editar</summary>
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
                              <ActionButton action={deleteModule} hidden={{ id: m.id }} label="Excluir módulo" variant="danger" icon={<Trash2 size={15} aria-hidden />} confirm confirmLabel="Excluir" confirmText="O módulo sai da trilha. Os conteúdos continuam cadastrados nesta trilha." />
                            </div>
                          </div>
                        </details>
                      </div>}
                    </div>

                    <ol className="divide-y divide-line">
                      {m.items.map((it, ii) => (
                        <li key={it.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="w-5 shrink-0 text-right font-mono text-[12px] text-muted">{ii + 1}</span>
                            <div className="min-w-0">
                              <Link href={`/conteudos/${it.content.id}`} className="text-[14px] font-medium hover:text-accent">{it.content.title}</Link>
                              <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                                <Badge tag={KIND_TAG[it.content.kind]}>{KIND_LABEL[it.content.kind]}</Badge>
                                {it.content.external_platform && ` · ${it.content.external_platform}`}
                                {it.content.status !== "publicado" && <Badge tag={PUBLISH_TAG[it.content.status]}>{PUBLISH_LABEL[it.content.status]}</Badge>}
                              </p>
                            </div>
                          </div>
                          {canEdit ? <div className="flex flex-wrap items-center gap-1">
                            <ActionButton
                              action={toggleRequired}
                              hidden={{ id: it.id, value: String(!it.is_required), track_id: id }}
                              label={it.is_required ? "Obrigatório" : "Opcional"}
                              variant={it.is_required ? "secondary" : "ghost"}
                              pendingLabel="…"
                            />
                            {ii > 0 && <ActionButton action={moveItem} hidden={{ id: it.id, direction: "-1", track_id: id }} label="Subir" icon={<ArrowUp size={16} aria-hidden />} iconOnly />}
                            {ii < m.items.length - 1 && (
                              <ActionButton action={moveItem} hidden={{ id: it.id, direction: "1", track_id: id }} label="Descer" icon={<ArrowDown size={16} aria-hidden />} iconOnly />
                            )}
                            <ActionButton action={removeItem} hidden={{ id: it.id, track_id: id }} label="Remover do módulo" variant="danger" icon={<X size={16} aria-hidden />} iconOnly confirm confirmLabel="Remover" confirmText="O conteúdo sai deste módulo, mas continua cadastrado nesta trilha." />
                          </div> : <Badge tag={it.is_required ? "trilha.etapa_obrigatoria" : "trilha.etapa_opcional"}>{it.is_required ? "Obrigatório" : "Opcional"}</Badge>}
                        </li>
                      ))}
                    </ol>

                    {canEdit && canCreateContent && (
                      <div className="flex flex-wrap gap-1 border-t border-line bg-bg/60 px-4 py-2.5">
                        <NewContentButton moduleId={m.id} compact />
                        <NewQuizButton moduleId={m.id} />
                      </div>
                    )}
                  </div>
                ))}

                {outside.length > 0 && (
                  <Card
                    title="Conteúdos desta trilha fora dos módulos"
                    description="Não aparecem para os colaboradores até entrarem num módulo."
                    icon={FilePlus2}
                    flush
                  >
                    <ul className="divide-y divide-line">
                      {outside.map((o) => (
                        <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-[14px] font-medium">{o.title}</span>
                            <Badge tag={KIND_TAG[o.kind]}>{KIND_LABEL[o.kind]}</Badge>
                            {o.status !== "publicado" && <Badge tag={PUBLISH_TAG[o.status as keyof typeof PUBLISH_TAG]}>{PUBLISH_LABEL[o.status as keyof typeof PUBLISH_LABEL]}</Badge>}
                          </span>
                          {canEdit && moduleOptions.length > 0 && <PlaceContent trackId={id} contentId={o.id} modules={moduleOptions} />}
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </>
            ),
          },
          ...(canEdit
            ? [
                {
                  key: "modulo",
                  label: "Novo módulo",
                  icon: <Plus size={16} aria-hidden />,
                  content: (
                    <Card title="Novo módulo" description="O módulo entra no fim da trilha; depois é possível reordenar na Estrutura." icon={Plus}>
                      <NewModuleForm trackId={id} />
                    </Card>
                  ),
                } satisfies TabDef,
              ]
            : []),
          ...(canCreateContent && formData
            ? [
                {
                  key: "conteudo",
                  label: "Novo conteúdo",
                  icon: <FilePlus2 size={16} aria-hidden />,
                  content: (
                    <Card title="Novo conteúdo nesta trilha" description="Crie como rascunho e publique quando estiver pronto. Ele pertence só a esta trilha." icon={FilePlus2}>
                      <ContentForm
                        action={saveContent}
                        rules={[]}
                        structure={structure}
                        owners={formData.owners}
                        categories={formData.categories}
                        tracks={formData.tracks}
                        defaultTrackId={id}
                        inTrack={{ tab: "conteudo", extra: canEdit ? <ModulePicker modules={moduleOptions} /> : undefined }}
                      />
                    </Card>
                  ),
                } satisfies TabDef,
              ]
            : []),
          ...(canEdit && canCreateContent
            ? [
                {
                  key: "avaliacao",
                  label: "Nova avaliação",
                  icon: <ClipboardCheck size={16} aria-hidden />,
                  content: (
                    <Card
                      title="Nova avaliação"
                      description="Prova com nota mínima, no fim da trilha ou no fim de um módulo. Ela conta como concluída quando a pessoa é aprovada."
                      icon={ClipboardCheck}
                    >
                      <NewQuizForm action={saveContent} trackId={id} modules={moduleOptions} />
                    </Card>
                  ),
                } satisfies TabDef,
              ]
            : []),
          ...(canEdit
            ? [
                {
                  key: "dados",
                  label: "Dados e público",
                  icon: <Settings2 size={16} aria-hidden />,
                  content: (
                    <Card>
                      <TrackForm action={saveTrack} track={track} rules={(rules ?? []) as AudienceRule[]} structure={structure} />
                    </Card>
                  ),
                } satisfies TabDef,
              ]
            : []),
        ]}
      />
    </>
  );
}
