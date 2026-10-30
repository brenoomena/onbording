import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState, Input, PageHeader, buttonVariants } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { KIND_LABEL, type ContentKind } from "@/lib/learning";
import { loadProgressOf } from "@/lib/my-learning";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Materiais" };

interface Row {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  kind: ContentKind;
  external_platform: string | null;
}

export default async function MateriaisPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireUser();
  const { q: rawQ } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("contents")
    .select("id, title, description, category, kind, external_platform")
    .eq("is_library", true)
    .eq("status", "publicado")
    .order("title");
  const q = (rawQ ?? "").replace(/[%,()*]/g, " ").trim();
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`);
  const [{ data }, progress] = await Promise.all([query, loadProgressOf(me.userId)]);
  const rows = (data ?? []) as Row[];

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.category ?? "Outros";
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));

  return (
    <>
      <PageHeader eyebrow="Aprendizagem" title="Materiais de apoio" description="Vídeos, apresentações e catálogos para consultar quando precisar, inclusive durante as reuniões com clientes." />
      <form method="get" className="flex flex-wrap gap-2">
        <Input name="q" defaultValue={rawQ} placeholder="Buscar material" aria-label="Buscar material" className="max-w-sm" />
        <button type="submit" className={buttonVariants.secondary}>Buscar</button>
        {q && <Link href="/materiais" className={buttonVariants.ghost}>Limpar</Link>}
      </form>
      {rows.length === 0 ? (
        <EmptyState title={q ? "Nenhum material encontrado" : "Nenhum material disponível para você ainda"} />
      ) : (
        ordered.map(([cat, items]) => (
          <section key={cat} className="grid gap-2">
            <h2 className="flex items-baseline gap-2 text-[13px] font-semibold uppercase tracking-[0.05em] text-muted">
              {cat} <span className="font-mono text-[11px] font-normal">{items.length}</span>
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {items.map((c) => (
                <li key={c.id}>
                  <Link href={`/estudar/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-accent-soft/40">
                    <span className="min-w-0">
                      <span className="block font-medium">{c.title}</span>
                      {c.description && <span className="block text-[12.5px] text-muted">{c.description}</span>}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {progress.byContent.has(c.id) && <Badge tone="ok">Visto</Badge>}
                      <Badge>{KIND_LABEL[c.kind]}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
