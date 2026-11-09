import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { loadStructure } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { TemplateEditor } from "../template-editor";

export const metadata: Metadata = { title: "Novo checklist" };

export default async function NovoChecklistPage() {
  await requirePermission(P.checklistsGerenciar);
  const supabase = await createClient();
  const [structure, { data: people }] = await Promise.all([loadStructure(), supabase.from("profiles").select("id, full_name").neq("status", "inativo").order("full_name")]);
  return (
    <>
      <PageHeader
        eyebrow="Checklists"
        icon={ClipboardList}
        title="Novo modelo de checklist"
        description="Liste o que precisa acontecer na chegada de alguém, quem faz cada coisa e em que prazo."
        actions={<Link href="/checklists" className="text-[13px] font-medium text-accent hover:underline">← Voltar</Link>}
      />
      <TemplateEditor rules={[]} structure={structure} people={(people ?? []) as { id: string; full_name: string }[]} />
    </>
  );
}
