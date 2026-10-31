import { FilePlus2 } from "lucide-react";
import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { loadStructure } from "@/lib/queries";
import { saveContent } from "../actions";
import { ContentForm } from "../content-form";
import { loadContentFormData } from "../form-data";

export const metadata: Metadata = { title: "Novo conteúdo" };

export default async function NovoConteudoPage({ searchParams }: { searchParams: Promise<{ trilha?: string }> }) {
  await requirePermission(P.conteudosCriar);
  const { trilha } = await searchParams;
  const [structure, { owners, categories, tracks }] = await Promise.all([loadStructure(), loadContentFormData()]);
  const preset = tracks.find((t) => t.id === trilha)?.id;
  return (
    <>
      <PageHeader
        eyebrow="Conteúdos"
        icon={FilePlus2}
        title="Novo conteúdo"
        description="Todo conteúdo pertence a uma trilha (ou fica só na Biblioteca). Crie como rascunho e publique quando estiver pronto."
      />
      <Card>
        <ContentForm action={saveContent} rules={[]} structure={structure} owners={owners} categories={categories} tracks={tracks} defaultTrackId={preset} />
      </Card>
    </>
  );
}
