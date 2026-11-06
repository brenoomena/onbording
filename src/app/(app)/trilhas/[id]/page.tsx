import { AlertCircle, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, CircleCheck, Eye, FilePlus2, LayoutGrid, Route, Settings2, Trash2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ActionButton, ActionForm, SubmitButton, PageNotice } from "@/components/forms";
import { Alert, Badge, Card, Field, Input, PageHeader, buttonVariants, cx } from "@/components/ui";
import { RichTextarea } from "@/components/rich-textarea";
import { can, requirePermission } from "@/lib/auth";
import { KIND_LABEL, PUBLISH_LABEL, type AudienceRule, type TrackModule } from "@/lib/learning";
import { P } from "@/lib/permissions";
import { loadStructure } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { KIND_TAG, PUBLISH_TAG } from "@/lib/tags";
import { saveContent } from "../../conteudos/actions";
import { ContentForm } from "../../conteudos/content-form";
import { loadContentFormData } from "../../conteudos/form-data";
import { deleteModule, deleteTrack, moveModule, saveTrack, setTrackStatus, updateModule } from "../actions";
import { TrackForm } from "../track-form";
import { loadTrack } from "./load";
import { ModuleItems } from "./module-items";
import { NewQuizButton, NewQuizForm } from "./quiz-form";
import { ModulePicker, NewContentButton, NewModuleForm, PlaceContent } from "./track-parts";
import { GoButton, TrackWorkspace, type WorkspacePanel, type WorkspaceSection } from "./workspace";

export const metadata: Metadata = { title: "Trilha" };

/** Endereços antigos (?aba=…) continuam abrindo a parte certa. */
const LEGACY: Record<string, { parte?: string; painel?: string }> = {
  estrutura: { parte: "visao" },
  modulo: { parte: "modulo" },
  dados: { parte: "dados" },
  conteudo: { painel: "conteudo" },
  avaliacao: { painel: "avaliacao" },
};

const minutesOf = (m: TrackModule) => m.items.reduce((s, i) => s + (i.content.estimated_minutes ?? 0), 0);

export default async function TrilhaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string; aba?: string; parte?: string; painel?: string }>;
}) {
  const me = await requirePermission(P.trilhasVer);
  const canEdit = can(me, P.trilhasEditar);
  const { id } = await params;
  const { aviso, aba, parte, painel } = await searchParams;
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
  const allItems = modules.flatMap((m) => m.items);
  const drafts = allItems.filter((i) => i.content.status !== "publicado");
  const placed = new Set(allItems.map((i) => i.content.id));
  const outside = options.filter((o) => !placed.has(o.id));
  const emptyModules = modules.filter((m) => m.items.length === 0);
  const audience = (rules ?? []) as AudienceRule[];
  const canEnroll = can(me, P.trilhasMatricular);

  // ------------------------------------------------------------ visão geral
  const check = (ok: boolean, text: ReactNode, action?: ReactNode) => (
    <li className={cx("flex flex-wrap items-center gap-2 text-[13.5px]", ok ? "text-ok" : "text-warn")}>
      {ok ? <CircleCheck size={16} aria-hidden /> : <AlertCircle size={16} aria-hidden />}
      <span className="text-ink">{text}</span>
      {action}
    </li>
  );
  const linkBtn = "text-[12.5px] font-semibold text-accent hover:underline";

  const overview = (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ["Módulos", modules.length],
            ["Conteúdos", allItems.length],
            ["Obrigatórios", allItems.filter((i) => i.is_required).length],
            ["Matrículas", enrolled ?? 0],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface px-4 py-3.5">
            <p className="text-[12px] text-muted">{label}</p>
            <p className="mt-0.5 text-[24px] font-semibold tabular-nums text-heading">{value}</p>
          </div>
        ))}
      </div>

      <Card
        title="Estrutura"
        description="Escolha um módulo no menu ao lado para editar os conteúdos dele."
        icon={LayoutGrid}
        flush
        actions={
          canEdit && canCreateContent ? (
            <div className="flex flex-wrap gap-2">
              <NewContentButton />
              <NewQuizButton />
            </div>
          ) : undefined
        }
      >
        {modules.length === 0 ? (
          <p className="px-5 py-4 text-[13px] text-muted">
            Nenhum módulo ainda.{" "}
            {canEdit && (
              <GoButton to="modulo" className={linkBtn}>
                Criar o primeiro módulo
              </GoButton>
            )}
          </p>
        ) : (
          <ol className="divide-y divide-line">
            {modules.map((m, i) => {
              const req = m.items.filter((x) => x.is_required).length;
              const min = minutesOf(m);
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-sunken text-[12px] font-semibold tabular-nums text-muted">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-[1_1_220px]">
                    <p className="font-medium text-heading">{m.title}</p>
                    <p className="text-[12px] text-muted">
                      {m.items.length} {m.items.length === 1 ? "conteúdo" : "conteúdos"} · {req} obrigatório{req === 1 ? "" : "s"}
                      {min > 0 && ` · ≈ ${min} min`}
                    </p>
                  </div>
                  <GoButton to={`m-${m.id}`} className={cx(buttonVariants.secondary, "py-1.5 text-[13px]")}>
                    Abrir módulo
                  </GoButton>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <Card title="Antes de publicar" icon={CircleCheck}>
        <ul className="grid gap-2">
          {check(modules.length > 0 && emptyModules.length === 0, modules.length === 0 ? "A trilha ainda não tem módulos" : emptyModules.length ? `Módulo sem conteúdo: ${emptyModules.map((m) => m.title).join(", ")}` : "Todos os módulos têm conteúdo")}
          {check(drafts.length === 0, drafts.length === 0 ? "Todos os conteúdos estão publicados" : `${drafts.length} ${drafts.length === 1 ? "conteúdo em rascunho" : "conteúdos em rascunho"}: ${drafts.map((d) => d.content.title).join(", ")}`)}
          {check(
            audience.length > 0 || track.is_mandatory,
            audience.length > 0 ? `Público automático definido (${audience.length} ${audience.length === 1 ? "regra" : "regras"})` : track.is_mandatory ? "Obrigatória para todos" : "Sem público automático: só matrículas manuais",
            canEdit && audience.length === 0 && !track.is_mandatory ? (
              <GoButton to="dados" className={linkBtn}>
                Definir público
              </GoButton>
            ) : undefined,
          )}
          {check(
            !!track.certificate_hours,
            track.certificate_hours ? `Carga horária do certificado: ${track.certificate_hours} h` : "Carga horária do certificado não informada",
            canEdit && !track.certificate_hours ? (
              <GoButton to="dados" className={linkBtn}>
                Informar
              </GoButton>
            ) : undefined,
          )}
        </ul>
      </Card>

      {outside.length > 0 && (
        <Card title="Conteúdos desta trilha fora dos módulos" description="Não aparecem para os colaboradores até entrarem num módulo." icon={FilePlus2} flush>
          <ul className="divide-y divide-line">
            {outside.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5">
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
  );

  // ------------------------------------------------------------ um módulo
  const modulePanel = (m: TrackModule, mi: number) => {
    const req = m.items.filter((x) => x.is_required).length;
    const min = minutesOf(m);
    const prev = modules[mi - 1];
    const next = modules[mi + 1];
    const navBtn = "grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-ink hover:border-brand";
    return (
      <>
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent">
              Módulo {mi + 1} de {modules.length}
            </p>
            <div className="flex flex-wrap items-center gap-1">
              {prev ? (
                <GoButton to={`m-${prev.id}`} label="Módulo anterior" className={navBtn}>
                  <ChevronLeft size={16} aria-hidden />
                </GoButton>
              ) : null}
              {next ? (
                <GoButton to={`m-${next.id}`} label="Próximo módulo" className={navBtn}>
                  <ChevronRight size={16} aria-hidden />
                </GoButton>
              ) : null}
              {canEdit && mi > 0 && <ActionButton action={moveModule} hidden={{ id: m.id, direction: "-1", track_id: id }} label="Subir módulo" icon={<ArrowUp size={16} aria-hidden />} iconOnly />}
              {canEdit && mi < modules.length - 1 && <ActionButton action={moveModule} hidden={{ id: m.id, direction: "1", track_id: id }} label="Descer módulo" icon={<ArrowDown size={16} aria-hidden />} iconOnly />}
              {canEdit && (
                <ActionButton
                  action={deleteModule}
                  hidden={{ id: m.id }}
                  label="Excluir módulo"
                  variant="danger"
                  icon={<Trash2 size={16} aria-hidden />}
                  iconOnly
                  confirm
                  confirmLabel="Excluir"
                  confirmText="O módulo sai da trilha. Os conteúdos continuam cadastrados nesta trilha."
                />
              )}
            </div>
          </div>
          {canEdit ? (
            <ActionForm action={updateModule}>
              <input type="hidden" name="id" value={m.id} />
              <Field label="Nome do módulo" htmlFor={`mt-${m.id}`}>
                <Input id={`mt-${m.id}`} name="title" defaultValue={m.title} required className="text-[16px] font-semibold" />
              </Field>
              <Field label="Descrição" htmlFor={`md-${m.id}`} hint="Aparece para o colaborador no início do módulo.">
                <RichTextarea id={`md-${m.id}`} name="description" rows={2} defaultValue={m.description ?? ""} maxLength={1000} />
              </Field>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12.5px] text-muted">
                  {m.items.length} {m.items.length === 1 ? "conteúdo" : "conteúdos"} · {req} obrigatório{req === 1 ? "" : "s"}
                  {min > 0 && ` · ≈ ${min} min`}
                </p>
                <SubmitButton variant="secondary" className="py-1.5 text-[13px]">
                  Salvar módulo
                </SubmitButton>
              </div>
            </ActionForm>
          ) : (
            <>
              <h2 className="text-[18px] font-semibold text-heading">{m.title}</h2>
              {m.description && <p className="mt-1 whitespace-pre-line text-[13.5px] text-muted">{m.description}</p>}
            </>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
            <h2 className="text-[15px] font-semibold">Conteúdos do módulo</h2>
            {canEdit && m.items.length > 1 && <span className="text-[12px] text-muted">Arraste pela alça para reordenar</span>}
          </div>
          <ModuleItems trackId={id} items={m.items} canEdit={canEdit} />
          {canEdit && canCreateContent && (
            <div className="flex flex-wrap gap-2 border-t border-line bg-bg/60 px-5 py-3.5">
              <NewContentButton moduleId={m.id} primary />
              <NewQuizButton moduleId={m.id} />
            </div>
          )}
        </section>
      </>
    );
  };

  const sections: WorkspaceSection[] = [
    { key: "visao", label: "Visão geral", group: "trilha", icon: <LayoutGrid size={17} aria-hidden />, content: overview },
    ...(canEdit
      ? [
          {
            key: "dados",
            label: "Dados e público",
            group: "trilha",
            icon: <Settings2 size={17} aria-hidden />,
            content: (
              <Card title="Dados e público" icon={Settings2}>
                <TrackForm action={saveTrack} track={track} rules={audience} structure={structure} />
              </Card>
            ),
          } satisfies WorkspaceSection,
        ]
      : []),
    ...(canEnroll
      ? [{ key: "matriculas", label: "Matrículas", group: "trilha", icon: <Users size={17} aria-hidden />, count: enrolled ?? 0, href: `/trilhas/${id}/matriculas` } satisfies WorkspaceSection]
      : []),
    ...(canEdit
      ? [
          {
            key: "modulo",
            label: "Novo módulo",
            group: "trilha",
            hidden: true,
            content: (
              <Card title="Novo módulo" description="O módulo entra no fim da trilha; depois é possível arrastar para mudar a ordem." icon={LayoutGrid}>
                <NewModuleForm trackId={id} />
              </Card>
            ),
          } satisfies WorkspaceSection,
        ]
      : []),
    ...modules.map(
      (m, mi): WorkspaceSection => ({
        key: `m-${m.id}`,
        label: m.title,
        group: "modulo",
        moduleId: m.id,
        count: m.items.length,
        content: modulePanel(m, mi),
      }),
    ),
  ];

  const panels: WorkspacePanel[] = [
    ...(canCreateContent && formData
      ? [
          {
            key: "conteudo",
            label: "Novo conteúdo",
            content: (
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
            ),
          },
        ]
      : []),
    ...(canEdit && canCreateContent
      ? [
          {
            key: "avaliacao",
            label: "Nova avaliação",
            content: <NewQuizForm action={saveContent} trackId={id} modules={moduleOptions} />,
          },
        ]
      : []),
  ];

  const legacy = aba ? LEGACY[aba] : undefined;
  const initial = parte ?? legacy?.parte ?? (aviso === "criada" && canEdit ? "modulo" : modules[0] ? `m-${modules[0].id}` : "visao");

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
              {modules.length} módulos · {allItems.length} conteúdos · {enrolled ?? 0} matrículas
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-start gap-2">
            <Link href={`/trilhas/${id}/ver`} className={buttonVariants.secondary}>
              <Eye size={16} aria-hidden /> Ver como colaborador
            </Link>
            {canEdit && track.status !== "publicado" && <ActionButton action={setTrackStatus} hidden={{ id, status: "publicado" }} label="Publicar" variant="primary" />}
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
      {aviso === "criada" && <PageNotice message="Trilha criada como rascunho. Crie os módulos e publique quando estiver pronta." />}
      {track.status === "publicado" && drafts.length > 0 && (
        <Alert tone="warn">
          {drafts.length} {drafts.length === 1 ? "conteúdo desta trilha está" : "conteúdos desta trilha estão"} em rascunho e não aparece
          {drafts.length === 1 ? "" : "m"} para os colaboradores: {drafts.map((d) => d.content.title).join(", ")}.
        </Alert>
      )}
      {!canEdit && <Alert tone="brand">Você pode consultar esta trilha. Para alterar, é preciso a permissão de editar trilhas.</Alert>}

      <TrackWorkspace trackId={id} sections={sections} panels={panels} initial={initial} initialPanel={painel ?? legacy?.painel} canEdit={canEdit} />
    </>
  );
}
