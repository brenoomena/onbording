import { Megaphone, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionButton, PageNotice } from "@/components/forms";
import { Card, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import type { AudienceRule } from "@/lib/learning";
import { P } from "@/lib/permissions";
import { loadStructure } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { deleteAnnouncement } from "../../actions";
import { AnnouncementForm, type AnnouncementDraft } from "../../announcement-form";

export const metadata: Metadata = { title: "Editar comunicado" };

export default async function EditarComunicadoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  await requirePermission(P.comunicadosGerenciar);
  const { id } = await params;
  const { aviso } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data }, { data: rules }, structure] = await Promise.all([
    supabase.from("announcements").select("id, title, body, importance, status").eq("id", id).maybeSingle(),
    supabase.from("announcement_audience").select("area_id, position_id, level_id").eq("announcement_id", id),
    loadStructure(),
  ]);
  if (!data) notFound();
  if (data.status !== "rascunho") redirect(`/comunicados/${id}`);
  return (
    <>
      <PageHeader
        eyebrow="Comunicados"
        icon={Megaphone}
        title="Editar rascunho"
        description="Ainda não foi enviado. Publique quando estiver pronto."
        actions={
          <div className="flex items-center gap-3">
            <ActionButton action={deleteAnnouncement} hidden={{ id }} label="Excluir rascunho" variant="danger" icon={<Trash2 size={15} aria-hidden />} confirm confirmLabel="Excluir" confirmText="O rascunho será apagado." />
            <Link href="/comunicados?aba=gerenciar" className="text-[13px] font-medium text-accent hover:underline">← Voltar</Link>
          </div>
        }
      />
      {aviso === "salvo" && <PageNotice message="Rascunho salvo. Ainda não foi enviado para ninguém." />}
      <Card>
        <AnnouncementForm draft={data as AnnouncementDraft} rules={(rules ?? []) as AudienceRule[]} structure={structure} />
      </Card>
    </>
  );
}
