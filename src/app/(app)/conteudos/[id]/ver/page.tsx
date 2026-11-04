import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import EstudarPage from "../../../estudar/[id]/page";

export const metadata: Metadata = { title: "Prévia do conteúdo" };

/** Prévia do conteúdo como o colaborador vê (sem registrar progresso de matrícula). */
export default async function VerConteudoPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(P.conteudosVer);
  return <EstudarPage params={params} searchParams={Promise.resolve({ previa: "1" })} />;
}
