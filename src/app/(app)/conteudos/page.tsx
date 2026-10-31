import { Eye, FileStack, Filter, LibraryBig, Pencil, Plus, Route, Search, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/forms";
import { Badge, Card, EmptyState, IconLink, Input, LinkButton, PageHeader, RowActions, Select, Table, buttonVariants, formatDate } from "@/components/ui";
import { can, requirePermission } from "@/lib/auth";
import { KIND_LABEL, PUBLISH_LABEL, type ContentKind, type PublishStatus } from "@/lib/learning";
import { P } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { deleteContent } from "./actions";

export const metadata: Metadata = { title: "Conteúdos" };

interface Row {
  id: string;
  title: string;
  category: string | null;
  kind: ContentKind;
  status: PublishStatus;
  external_platform: string | null;
  is_library: boolean;
  updated_at: string;
  track_id: string | null;
  module_items: { count: number }[];
}

const statusTone = { rascunho: "warn", publicado: "ok", arquivado: "neutral" } as const;
const LIBRARY = "biblioteca";

export default async function ConteudosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; status?: string; trilha?: string }>;
}) {
  const me = await requirePermission(P.conteudosVer);
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("contents")
    .select("id, title, category, kind, status, external_platform, is_library, updated_at, track_id, module_items(count)")
    .order("title")
    .limit(500);
  const q = (sp.q ?? "").replace(/[%,()*]/g, " ").trim();
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  if (sp.tipo && sp.tipo in KIND_LABEL) query = query.eq("kind", sp.tipo);
  if (sp.status && sp.status in PUBLISH_LABEL) query = query.eq("status", sp.status);
  if (sp.trilha === LIBRARY) query = query.is("track_id", null);
  else if (sp.trilha && /^[0-9a-f-]{36}$/i.test(sp.trilha)) query = query.eq("track_id", sp.trilha);

  const [{ data }, { data: trackRows }] = await Promise.all([query, supabase.from("tracks").select("id, name, status").order("name")]);
  const rows = (data ?? []) as Row[];
  const tracks = (trackRows ?? []) as { id: string; name: string; status: PublishStatus }[];
  const trackName = new Map(tracks.map((t) => [t.id, t.name]));
  const filtered = !!(q || sp.tipo || sp.status || sp.trilha);

  // Organiza por trilha (na ordem alfabética das trilhas) e a Biblioteca por último.
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = r.track_id ?? LIBRARY;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) =>
    a === LIBRARY ? 1 : b === LIBRARY ? -1 : (trackName.get(a) ?? "").localeCompare(trackName.get(b) ?? "", "pt-BR"),
  );

  const canCreate = can(me, P.conteudosCriar);
  const canEdit = can(me, P.conteudosEditar);
  const canDelete = can(me, P.conteudosExcluir);
  const newButton = canCreate && (
    <LinkButton href={sp.trilha && sp.trilha !== LIBRARY ? `/conteudos/novo?trilha=${sp.trilha}` : "/conteudos/novo"}>
      <Plus size={16} aria-hidden /> Novo conteúdo
    </LinkButton>
  );

  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        icon={FileStack}
        title="Conteúdos"
        description="Textos, vídeos, arquivos e links organizados pela trilha a que pertencem. Materiais só de consulta ficam na Biblioteca."
        actions={newButton}
      />

      <Card title="Filtros" description="Refine por trilha, formato e situação" icon={Filter}>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.4fr_1fr_1fr_auto] lg:items-end">
          <div className="grid gap-1">
            <label htmlFor="q" className="text-[12px] font-medium text-muted">Buscar</label>
            <div className="relative">
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input id="q" name="q" defaultValue={sp.q} placeholder="Título ou descrição" className="pl-9" />
            </div>
          </div>
          <div className="grid gap-1">
            <label htmlFor="trilha" className="text-[12px] font-medium text-muted">Trilha</label>
            <Select id="trilha" name="trilha" defaultValue={sp.trilha ?? ""}>
              <option value="">Todas as trilhas</option>
              {tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              <option value={LIBRARY}>Biblioteca (sem trilha)</option>
            </Select>
          </div>
          <div className="grid gap-1">
            <label htmlFor="tipo" className="text-[12px] font-medium text-muted">Formato</label>
            <Select id="tipo" name="tipo" defaultValue={sp.tipo ?? ""}>
              <option value="">Todos</option>
              {(Object.keys(KIND_LABEL) as ContentKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </Select>
          </div>
          <div className="grid gap-1">
            <label htmlFor="status" className="text-[12px] font-medium text-muted">Situação</label>
            <Select id="status" name="status" defaultValue={sp.status ?? ""}>
              <option value="">Todas</option>
              {(Object.keys(PUBLISH_LABEL) as PublishStatus[]).map((s) => <option key={s} value={s}>{PUBLISH_LABEL[s]}</option>)}
            </Select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={buttonVariants.primary}>Filtrar</button>
            {filtered && <Link href="/conteudos" className={buttonVariants.ghost}>Limpar</Link>}
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title={filtered ? "Nenhum conteúdo com esses filtros" : "Nenhum conteúdo cadastrado"}
          action={!filtered && newButton}
        />
      ) : (
        ordered.map(([key, list]) => {
          const isLib = key === LIBRARY;
          return (
            <Card
              key={key}
              flush
              icon={isLib ? LibraryBig : Route}
              title={isLib ? "Biblioteca (sem trilha)" : trackName.get(key) ?? "Trilha"}
              description={`${list.length} ${list.length === 1 ? "conteúdo" : "conteúdos"}`}
              actions={
                <div className="flex gap-2">
                  {!isLib && can(me, P.trilhasVer) && (
                    <Link href={`/trilhas/${key}`} className={`${buttonVariants.ghost} py-1.5 text-[13px]`}>Abrir trilha</Link>
                  )}
                  {canCreate && !isLib && (
                    <Link href={`/conteudos/novo?trilha=${key}`} className={`${buttonVariants.secondary} py-1.5 text-[13px]`}>
                      <Plus size={15} aria-hidden /> Conteúdo nesta trilha
                    </Link>
                  )}
                </div>
              }
            >
              <Table flush>
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Formato</th>
                    <th>Uso</th>
                    <th>Atualizado</th>
                    <th>Situação</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => {
                    const inModules = (c.module_items[0]?.count ?? 0) > 0;
                    return (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/conteudos/${c.id}`} className="font-medium text-heading hover:text-accent">{c.title}</Link>
                          <p className="text-[12px] text-muted">
                            {[c.category, c.external_platform].filter(Boolean).join(" · ") || " "}
                          </p>
                        </td>
                        <td className="text-[13px]">{KIND_LABEL[c.kind]}</td>
                        <td className="text-[13px]">
                          <span className="flex flex-wrap items-center gap-1">
                            {isLib ? null : inModules ? <span>Em módulo</span> : <span className="text-warn">Fora dos módulos</span>}
                            {c.is_library && <Badge tone="brand">Biblioteca</Badge>}
                          </span>
                        </td>
                        <td className="text-[13px] tabular-nums">{formatDate(c.updated_at)}</td>
                        <td><Badge tone={statusTone[c.status]}>{PUBLISH_LABEL[c.status]}</Badge></td>
                        <td>
                          <RowActions>
                            <IconLink href={`/estudar/${c.id}?previa=1`} label="Ver como colaborador" icon={Eye} />
                            <IconLink href={`/conteudos/${c.id}`} label={canEdit ? "Editar conteúdo" : "Abrir conteúdo"} icon={Pencil} />
                            {canDelete && (
                              <ActionButton
                                action={deleteContent}
                                hidden={{ id: c.id }}
                                label="Excluir conteúdo"
                                variant="danger"
                                icon={<Trash2 size={16} aria-hidden />}
                                iconOnly
                                confirm
                                confirmLabel="Excluir conteúdo"
                                confirmText={
                                  inModules
                                    ? `"${c.title}" está em um módulo. Remova-o da trilha antes, ou arquive o conteúdo.`
                                    : `"${c.title}" e o arquivo enviado serão apagados definitivamente.`
                                }
                              />
                            )}
                          </RowActions>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card>
          );
        })
      )}
    </>
  );
}
