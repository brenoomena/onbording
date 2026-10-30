import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { loadStructure } from "@/lib/queries";
import { saveContent } from "../actions";
import { ContentForm } from "../content-form";
import { loadContentFormData } from "../form-data";

export const metadata: Metadata = { title: "Novo conteúdo" };

export default async function NovoConteudoPage() {
  await requirePermission(P.conteudosGerenciar);
  const [structure, { owners, categories }] = await Promise.all([loadStructure(), loadContentFormData()]);
  return (
    <>
      <PageHeader eyebrow="Conteúdos" title="Novo conteúdo" description="Crie como rascunho e publique quando estiver pronto. Só conteúdos publicados aparecem para os colaboradores." />
      <Card>
        <ContentForm action={saveContent} rules={[]} structure={structure} owners={owners} categories={categories} />
      </Card>
    </>
  );
}
