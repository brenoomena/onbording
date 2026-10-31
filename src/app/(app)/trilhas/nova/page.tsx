import { Route } from "lucide-react";
import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { loadStructure } from "@/lib/queries";
import { saveTrack } from "../actions";
import { TrackForm } from "../track-form";

export const metadata: Metadata = { title: "Nova trilha" };

export default async function NovaTrilhaPage() {
  await requirePermission(P.trilhasCriar);
  const structure = await loadStructure();
  return (
    <>
      <PageHeader eyebrow="Trilhas" icon={Route} title="Nova trilha" description="A trilha nasce como rascunho. Depois de montar os módulos, publique para liberar aos colaboradores." />
      <Card>
        <TrackForm action={saveTrack} rules={[]} structure={structure} />
      </Card>
    </>
  );
}
