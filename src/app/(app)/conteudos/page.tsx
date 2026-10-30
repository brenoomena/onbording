import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState, Input, LinkButton, PageHeader, Select, Table, buttonVariants, formatDate } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { KIND_LABEL, PUBLISH_LABEL, type ContentKind, type PublishStatus } from "@/lib/learning";
import { P } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

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
  module_items: { count: number }[];
}

const statusTone = { rascunho: "warn", publicado: "ok", arquivado: "neutral" } as const;

export default async function ConteudosPage({ searchParams }: { searchParams: Promise<{ q?: string; tipo?: string; status?: string; categoria?: string }> }) {
  await requirePermission(P.conteudosGerenciar);
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("contents")
    .select("id, title, category, kind, status, external_platform, is_library, updated_at, module_items(count)")
    .order("updated_at", { ascending: false })
    .limit(300);
  const q = (sp.q ?? "").replace(/[%,()*]/g, " ").trim();
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
  if (sp.tipo && sp.tipo in KIND_LABEL) query = query.eq("kind", sp.tipo);
  if (sp.status && sp.status in PUBLISH_LABEL) query = query.eq("status", sp.status);
  if (sp.categoria) query = query.eq("category", sp.categoria);

  const [{ data }, { data: cats }] = await Promise.all([query, supabase.from("contents").select("category").not("category", "is", null)]);
  const rows = (data ?? []) as Row[];
  const categories = [...new Set((cats ?? []).map((c) => c.category as string))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const filtered = !!(q || sp.tipo || sp.status || sp.categoria);

  return (
    <>
      <PageHeader
        eyebrow="Aprendizagem"
        title="Conteúdos"
        description="Textos, vídeos, arquivos e links para cursos externos. Um conteúdo pode estar em várias trilhas e na biblioteca."
        actions={<LinkButton href="/conteudos/novo">Novo conteúdo</LinkButton>}
      />
      <form method="get" className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
        <div className="grid gap-1">
          <label htmlFor="q" className="text-[12px] font-medium text-muted">Buscar</label>
          <Input id="q" name="q" defaultValue={sp.q} placeholder="Título ou descrição" />
        </div>
        <div className="grid gap-1">
          <label htmlFor="tipo" className="text-[12px] font-medium text-muted">Formato</label>
          <Select id="tipo" name="tipo" defaultValue={sp.tipo ?? ""}>
            <option value="">Todos</option>
            {(Object.keys(KIND_LABEL) as ContentKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </Select>
        </div>
        <div className="grid gap-1">
          <label htmlFor="categoria" className="text-[12px] font-medium text-muted">Categoria</label>
          <Select id="categoria" name="categoria" defaultValue={sp.categoria ?? ""}>
            <option value="">Todas</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <div className="grid gap-1">
          <label htmlFor="status" className="text-[12px] font-medium text-muted">Status</label>
          <Select id="status" name="status" defaultValue={sp.status ?? ""}>
            <option value="">Todos</option>
            {(Object.keys(PUBLISH_LABEL) as PublishStatus[]).map((s) => <option key={s} value={s}>{PUBLISH_LABEL[s]}</option>)}
          </Select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className={buttonVariants.primary}>Filtrar</button>
          {filtered && <Link href="/conteudos" className={buttonVariants.ghost}>Limpar</Link>}
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={filtered ? "Nenhum conteúdo com esses filtros" : "Nenhum conteúdo cadastrado"}
          action={!filtered && <LinkButton href="/conteudos/novo">Criar o primeiro</LinkButton>}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Título</th>
              <th>Formato</th>
              <th>Categoria</th>
              <th>Uso</th>
              <th>Atualizado</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const uses = c.module_items[0]?.count ?? 0;
              return (
                <tr key={c.id} className="hover:bg-accent-soft/40">
                  <td>
                    <Link href={`/conteudos/${c.id}`} className="font-medium hover:text-accent">{c.title}</Link>
                    {c.external_platform && <p className="text-[12px] text-muted">{c.external_platform}</p>}
                  </td>
                  <td className="text-[13px]">{KIND_LABEL[c.kind]}</td>
                  <td className="text-[13px]">{c.category ?? <span className="text-muted">—</span>}</td>
                  <td className="text-[13px]">
                    {uses > 0 ? `${uses} ${uses === 1 ? "trilha" : "trilhas"}` : <span className="text-muted">Fora de trilhas</span>}
                    {c.is_library && <span className="ml-1.5"><Badge tone="brand">Biblioteca</Badge></span>}
                  </td>
                  <td className="text-[13px] tabular-nums">{formatDate(c.updated_at)}</td>
                  <td><Badge tone={statusTone[c.status]}>{PUBLISH_LABEL[c.status]}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
