import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/forms";
import { Alert, Card, PageHeader, StatusBadge, formatDate, formatDateTime } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { PROFILE_SELECT, loadStructure, loadSupervisorOptions, type ProfileRow } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { resendInvite, setProfileStatus, updateProfile } from "../actions";
import { ProfileForm } from "../profile-form";

export const metadata: Metadata = { title: "Colaborador" };

export default async function ColaboradorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string }>;
}) {
  const me = await requirePermission(P.colaboradoresVer, P.equipeVer);
  const { id } = await params;
  const { aviso } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();
  const person = data as unknown as ProfileRow;

  const canManage = me.permissions.has(P.colaboradoresGerenciar);
  const isSelf = person.id === me.userId;

  const header = (
    <PageHeader
      eyebrow="Colaboradores"
      title={person.full_name}
      description={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{person.email}</span>
          <StatusBadge status={person.status} />
          <span className="text-[12.5px]">
            {person.last_access_at ? `Último acesso ${formatDateTime(person.last_access_at)}` : "Ainda não acessou a plataforma"}
          </span>
        </span>
      }
      actions={
        canManage && (
          <div className="flex flex-wrap items-start gap-2">
            {person.status !== "inativo" && !person.last_access_at && (
              <ActionButton action={resendInvite} hidden={{ id: person.id }} label="Reenviar convite" pendingLabel="Enviando…" />
            )}
            {!isSelf &&
              (person.status === "inativo" ? (
                <ActionButton action={setProfileStatus} hidden={{ id: person.id, status: "ativo" }} label="Reativar" variant="secondary" />
              ) : (
                <ActionButton
                  action={setProfileStatus}
                  hidden={{ id: person.id, status: "inativo" }}
                  label="Desativar"
                  variant="danger"
                  confirm
                  confirmLabel="Desativar acesso"
                />
              ))}
          </div>
        )
      }
    />
  );

  if (!canManage) {
    return (
      <>
        {header}
        <Card title="Cadastro">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Área", person.area?.name],
              ["Cargo", person.position?.name],
              ["Nível", person.level?.name],
              ["Supervisor", person.supervisor?.full_name],
              ["Perfil de acesso", person.role?.name],
              ["Admissão", formatDate(person.admission_date)],
              ["Início do onboarding", formatDate(person.onboarding_start_date)],
            ].map(([k, v]) => (
              <div key={k} className="grid gap-0.5">
                <dt className="text-[12.5px] text-muted">{k}</dt>
                <dd className="font-medium">{v || "Não definido"}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Link href="/colaboradores" className="text-[13px] font-medium text-accent hover:underline">← Voltar para a lista</Link>
      </>
    );
  }

  const [structure, supervisors] = await Promise.all([loadStructure(), loadSupervisorOptions()]);

  return (
    <>
      {header}
      {aviso === "convidado" && (
        <Alert tone="ok">Colaborador cadastrado. O convite de acesso foi enviado para {person.email}.</Alert>
      )}
      {isSelf && (
        <Alert tone="brand">Este é o seu cadastro. Por segurança, você não pode alterar o próprio perfil de acesso nem se desativar.</Alert>
      )}
      <Card>
        <ProfileForm
          mode="edit"
          action={updateProfile}
          structure={structure}
          supervisors={supervisors}
          canChangeRole={me.permissions.has(P.perfisGerenciar) && !isSelf}
          values={person}
        />
      </Card>
      <Link href="/colaboradores" className="text-[13px] font-medium text-accent hover:underline">← Voltar para a lista</Link>
    </>
  );
}
