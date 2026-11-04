import { Eye, FileText, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, PageNotice } from "@/components/forms";
import { Alert, Card, PageHeader, buttonVariants } from "@/components/ui";
import { can, requirePermission } from "@/lib/auth";
import type { AudienceRule, ContentRow } from "@/lib/learning";
import { P } from "@/lib/permissions";
import { loadStructure } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { deleteContent, saveContent } from "../actions";
import { ContentForm } from "../content-form";
import { loadContentFormData } from "../form-data";

export const metadata: Metadata = { title: "Conteúdo" };

export default async function ConteudoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  const me = await requirePermission(P.conteudosVer);
  const canEdit = can(me, P.conteudosEditar);
  const { id } = await params;
  const { aviso } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: content }, { data: rules }, { data: uses }, structure, { owners, categories, tracks }] = await Promise.all([
    supabase.from("contents").select("*").eq("id", id).maybeSingle(),
    supabase.from("audience_rules").select("area_id, position_id, level_id").eq("content_id", id),
    supabase.from("module_items").select("module:modules(id, title, track:tracks(id, name))").eq("content_id", id),
    loadStructure(),
    loadContentFormData(),
  ]);
  if (!content) notFound();
  const c = content as ContentRow;
  const usedIn = ((uses ?? []) as unknown as { module: { title: string; track: { id: string; name: string } } }[]).map((u) => u.module);

  return (
    <>
      <PageHeader
        eyebrow="Conteúdos"
        icon={FileText}
        title={c.title}
        actions={
          <div className="flex flex-wrap items-start gap-2">
            <Link href={`/conteudos/${c.id}/ver`} className={buttonVariants.secondary}>
              <Eye size={16} aria-hidden /> Ver como colaborador
            </Link>
            {usedIn.length === 0 && can(me, P.conteudosExcluir) && (
              <ActionButton action={deleteContent} hidden={{ id: c.id, voltar: "1" }} label="Excluir" variant="danger" icon={<Trash2 size={15} aria-hidden />} confirm confirmLabel="Excluir conteúdo" confirmText="O conteúdo e o arquivo enviado serão apagados definitivamente." />
            )}
          </div>
        }
      />
      {aviso === "criado" && (
        <PageNotice
          message={
            c.status === "publicado"
              ? "Conteúdo criado e publicado. Inclua-o em um módulo da trilha (ou marque para a Biblioteca) para os colaboradores verem."
              : "Conteúdo criado como rascunho. Quando estiver pronto, clique em Publicar."
          }
        />
      )}
      {usedIn.length > 0 && (
        <Alert tone="brand">
          Usado em:{" "}
          {usedIn.map((m, i) => (
            <span key={i}>
              {i > 0 && ", "}
              <Link href={`/trilhas/${m.track.id}`} className="font-semibold underline">{m.track.name}</Link> › {m.title}
            </span>
          ))}
          . Alterações valem para todas essas trilhas.
        </Alert>
      )}
      <Card>
        <ContentForm
          action={saveContent}
          content={c}
          rules={(rules ?? []) as AudienceRule[]}
          structure={structure}
          owners={owners}
          categories={categories}
          tracks={tracks}
          readOnly={!canEdit}
          modulesCount={usedIn.filter((m) => m.track.id === c.track_id).length}
        />
      </Card>
    </>
  );
}
