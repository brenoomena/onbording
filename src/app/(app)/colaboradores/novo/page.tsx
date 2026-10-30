import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { loadStructure, loadSupervisorOptions } from "@/lib/queries";
import { createProfile } from "../actions";
import { ProfileForm } from "../profile-form";

export const metadata: Metadata = { title: "Cadastrar colaborador" };

export default async function NovoColaboradorPage() {
  const me = await requirePermission(P.colaboradoresGerenciar);
  const [structure, supervisors] = await Promise.all([loadStructure(), loadSupervisorOptions()]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  return (
    <>
      <PageHeader
        eyebrow="Colaboradores"
        title="Cadastrar colaborador"
        description="A pessoa recebe por e-mail um convite para criar a própria senha. O link vale por 24 horas e pode ser reenviado."
      />
      <Card>
        <ProfileForm
          mode="create"
          action={createProfile}
          structure={structure}
          supervisors={supervisors}
          canChangeRole={me.permissions.has(P.perfisGerenciar)}
          values={{ status: "onboarding", admission_date: today, onboarding_start_date: today }}
        />
      </Card>
    </>
  );
}
