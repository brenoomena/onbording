import { Archive, ClipboardList, Trash2, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, PageNotice } from "@/components/forms";
import { Badge, Card, PageHeader, formatDate } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import type { ResponsibleKind } from "@/lib/checklist";
import type { AudienceRule } from "@/lib/learning";
import { P } from "@/lib/permissions";
import { loadStructure } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { PUBLISH_TAG } from "@/lib/tags";
import { deleteTemplate, setTemplateStatus } from "../actions";
import { TemplateEditor } from "../template-editor";

export const metadata: Metadata = { title: "Checklist" };

const STATUS_LABEL = { rascunho: "Rascunho", publicado: "Publicado", arquivado: "Arquivado" } as const;
const NOTICE: Record<string, string> = {
  salvo: "Modelo salvo.",
  publicado: "Modelo publicado. Quem está em onboarding e atende ao público já recebeu o checklist.",
};

export default async function ChecklistPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  await requirePermission(P.checklistsGerenciar);
  const { id } = await params;
  const { aviso } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: tpl }, { data: items }, { data: audience }, { data: applied }, structure, { data: people }] = await Promise.all([
    supabase.from("checklist_templates").select("id, name, description, status, auto_apply, updated_at").eq("id", id).maybeSingle(),
    supabase.from("checklist_template_items").select("title, description, responsible_kind, responsible_id, offset_days").eq("template_id", id).order("position"),
    supabase.from("checklist_template_audience").select("area_id, position_id, level_id").eq("template_id", id),
    supabase.from("onboarding_checklists").select("id, profile_id, completed_at, applied_at, person:profiles(full_name)").eq("template_id", id).order("applied_at", { ascending: false }),
    loadStructure(),
    supabase.from("profiles").select("id, full_name").neq("status", "inativo").order("full_name"),
  ]);
  if (!tpl) notFound();
  const status = tpl.status as keyof typeof STATUS_LABEL;
  const list = (applied ?? []) as unknown as { id: string; profile_id: string; completed_at: string | null; applied_at: string; person: { full_name: string } | null }[];

  return (
    <>
      <PageHeader
        eyebrow="Checklists"
        icon={ClipboardList}
        title={tpl.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tag={PUBLISH_TAG[status]}>{STATUS_LABEL[status]}</Badge>
            <span>
              {(items ?? []).length} tarefas · aplicado a {list.length} {list.length === 1 ? "pessoa" : "pessoas"} · atualizado em {formatDate(tpl.updated_at)}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-start gap-2">
            {status === "publicado" && (
              <ActionButton action={setTemplateStatus} hidden={{ id, status: "rascunho" }} label="Voltar para rascunho" icon={<Undo2 size={15} aria-hidden />} confirm confirmLabel="Voltar para rascunho" confirmText="O modelo deixa de ser aplicado automaticamente. Quem já recebeu continua com o checklist." />
            )}
            {status !== "arquivado" && (
              <ActionButton action={setTemplateStatus} hidden={{ id, status: "arquivado" }} label="Arquivar" icon={<Archive size={15} aria-hidden />} confirm confirmLabel="Arquivar" confirmText="O modelo sai da lista de aplicação. Os checklists já criados continuam com as pessoas." />
            )}
            {status === "arquivado" && <ActionButton action={setTemplateStatus} hidden={{ id, status: "rascunho" }} label="Reativar como rascunho" icon={<Undo2 size={15} aria-hidden />} />}
            {list.length === 0 && (
              <ActionButton action={deleteTemplate} hidden={{ id }} label="Excluir" variant="danger" icon={<Trash2 size={15} aria-hidden />} confirm confirmLabel="Excluir modelo" confirmText="O modelo e as tarefas dele serão apagados. Só é possível porque ainda não foi aplicado a ninguém." />
            )}
            <Link href="/checklists" className="self-center text-[13px] font-medium text-accent hover:underline">
              ← Voltar
            </Link>
          </div>
        }
      />
      {aviso && NOTICE[aviso] && <PageNotice message={NOTICE[aviso]} />}

      <TemplateEditor
        key={tpl.updated_at}
        draft={{
          id: tpl.id,
          name: tpl.name,
          description: tpl.description ?? "",
          auto_apply: tpl.auto_apply,
          status,
          items: (items ?? []).map((i) => ({
            title: i.title,
            description: i.description ?? "",
            responsibleKind: i.responsible_kind as ResponsibleKind,
            responsibleId: i.responsible_id ?? "",
            offsetDays: i.offset_days,
          })),
        }}
        rules={(audience ?? []) as AudienceRule[]}
        structure={structure}
        people={(people ?? []) as { id: string; full_name: string }[]}
      />

      {list.length > 0 && (
        <Card title={`Pessoas com este checklist · ${list.length}`} flush>
          <ul className="divide-y divide-line">
            {list.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-[13.5px]">
                <Link href={`/colaboradores/${c.profile_id}`} className="font-medium hover:text-accent hover:underline">
                  {c.person?.full_name ?? "—"}
                </Link>
                <span className="text-[12.5px] text-muted">
                  {c.completed_at ? `Concluído em ${formatDate(c.completed_at)}` : `Em andamento desde ${formatDate(c.applied_at)}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
