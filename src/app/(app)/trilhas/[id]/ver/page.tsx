import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import MinhaTrilhaPage from "../../../minhas-trilhas/[id]/page";

export const metadata: Metadata = { title: "Prévia da trilha" };

/** Prévia da trilha como o colaborador vê. */
export default async function VerTrilhaPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(P.trilhasVer);
  return <MinhaTrilhaPage params={params} />;
}
