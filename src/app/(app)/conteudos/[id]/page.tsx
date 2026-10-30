import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/forms";
import { Alert, Card, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import type { AudienceRule, ContentRow } from "@/lib/learning";
import { P } from "@/lib/permissions";
import { loadStructure } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { deleteContent, saveContent } from "../actions";
import { ContentForm } from "../content-form";
import { loadContentFormData } from "../form-data";

export const metadata: Metadata = { title: "Conteúdo" };

export default async function ConteudoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  await requirePermission(P.conteudosGerenciar);
  const { id } = await params;
  const { aviso } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: content }, { data: rules }, { data: uses }, structure, { owners, categories }] = await Promise.all([
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
        title={c.title}
        actions={
          <div className="flex flex-wrap items-start gap-2">
            <Link href={`/estudar/${c.id}?previa=1`} className="rounded-lg border border-line px-3.5 py-1.5 text-[13px] font-semibold hover:bg-sunken">
              Ver como colaborador
            </Link>
            {usedIn.length === 0 && (
              <ActionButton action={deleteContent} hidden={{ id: c.id }} label="Excluir" variant="danger" confirm confirmLabel="Excluir conteúdo" />
            )}
          </div>
        }
      />
      {aviso === "criado" && (
        <Alert tone="ok">
          {c.status === "publicado"
            ? "Conteúdo criado e publicado. Para os colaboradores verem, inclua em uma trilha ou marque para a biblioteca."
            : "Conteúdo criado como rascunho. Quando estiver pronto, clique em Publicar."}
        </Alert>
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
        />
      </Card>
    </>
  );
}
