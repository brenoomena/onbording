import { Megaphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { loadStructure } from "@/lib/queries";
import { AnnouncementForm } from "../announcement-form";

export const metadata: Metadata = { title: "Novo comunicado" };

export default async function NovoComunicadoPage() {
  await requirePermission(P.comunicadosGerenciar);
  const structure = await loadStructure();
  return (
    <>
      <PageHeader
        eyebrow="Comunicados"
        icon={Megaphone}
        title="Novo comunicado"
        description="Escreva o recado, escolha o público e publique. Cada pessoa recebe um aviso no sininho."
        actions={<Link href="/comunicados?aba=gerenciar" className="text-[13px] font-medium text-accent hover:underline">← Voltar</Link>}
      />
      <Card>
        <AnnouncementForm rules={[]} structure={structure} />
      </Card>
    </>
  );
}
