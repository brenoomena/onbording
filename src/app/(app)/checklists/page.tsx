import { ClipboardList, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageNotice } from "@/components/forms";
import { Badge, Card, EmptyState, PageHeader, buttonVariants, formatDate } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { PUBLISH_TAG } from "@/lib/tags";

export const metadata: Metadata = { title: "Checklists" };

interface Row {
  id: string;
  name: string;
  description: string | null;
  status: "rascunho" | "publicado" | "arquivado";
  auto_apply: boolean;
  updated_at: string;
  items: { count: number }[];
  audience: { count: number }[];
  applied: { count: number }[];
}
const STATUS_LABEL = { rascunho: "Rascunho", publicado: "Publicado", arquivado: "Arquivado" } as const;

export default async function ChecklistsPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  await requirePermission(P.checklistsGerenciar);
  const { aviso } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("checklist_templates")
    .select("id, name, description, status, auto_apply, updated_at, items:checklist_template_items(count), audience:checklist_template_audience(count), applied:onboarding_checklists(count)")
    .order("status")
    .order("name");
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader
        eyebrow="Integração"
        icon={ClipboardList}
        title="Checklists de integração"
        description="Modelos com as tarefas da chegada de cada pessoa: quem faz, o quê e quando. Publicados, são aplicados sozinhos a quem entra em onboarding."
        actions={
          <Link href="/checklists/novo" className={buttonVariants.primary}>
            <Plus size={16} aria-hidden /> Novo modelo
          </Link>
        }
      />
      {aviso === "excluido" && <PageNotice message="Modelo excluído." />}
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="Nenhum modelo ainda"
            action={
              <Link href="/checklists/novo" className={buttonVariants.primary}>
                <Plus size={16} aria-hidden /> Criar o primeiro modelo
              </Link>
            }
          >
            Ex.: “Integração Comercial” com criar e-mail (TI, 3 dias antes), entregar crachá (RH, no dia) e conversa de 30 dias (supervisor).
          </EmptyState>
        </Card>
      ) : (
        <Card flush>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-[1_1_260px]">
                  <Link href={`/checklists/${r.id}`} className="text-[15px] font-semibold text-heading hover:text-accent hover:underline">
                    {r.name}
                  </Link>
                  {r.description && <p className="line-clamp-1 text-[12.5px] text-muted">{r.description}</p>}
                  <p className="mt-0.5 text-[12px] text-muted">
                    {r.items[0]?.count ?? 0} tarefas · {r.audience[0]?.count ? `${r.audience[0].count} regra(s) de público` : "todas as pessoas em onboarding"} ·{" "}
                    {r.auto_apply ? "aplicação automática" : "aplicação manual"} · {r.applied[0]?.count ?? 0} pessoa(s) · atualizado em {formatDate(r.updated_at)}
                  </p>
                </div>
                <Badge tag={PUBLISH_TAG[r.status]}>{STATUS_LABEL[r.status]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
