import { IdCard, Mail, Pencil, ShieldCheck, UserCheck, UserX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { ActionButton, PageNotice } from "@/components/forms";
import { Alert, Badge, Card, PageHeader, StatusBadge, buttonVariants, formatDate, formatDateTime, LevelBadge } from "@/components/ui";
import { can, isAdmin, requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { PROFILE_SELECT, type ProfileRow } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { setProfileStatus } from "../actions";
import { loadPersonPermissions } from "../load-permissions";
import { LearningCard } from "./learning-card";

export const metadata: Metadata = { title: "Colaborador" };

/** Visualização do cadastro (somente leitura). A edição fica em /editar. */
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

  const admin = isAdmin(me);
  const isSelf = person.id === me.userId;
  const targetIsAdmin = person.role?.key === "admin";
  const canEdit = (can(me, P.colaboradoresEditar) || admin) && (!targetIsAdmin || admin);
  const canDeactivate = can(me, P.colaboradoresDesativar) && !isSelf && (!targetIsAdmin || admin);
  const perms = admin ? await loadPersonPermissions(person.id, person.role_id) : null;
  const custom = perms ? Object.entries(perms.overrides) : [];

  return (
    <>
      <PageHeader
        eyebrow="Colaboradores"
        title={person.full_name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1"><Mail size={14} aria-hidden /> {person.email}</span>
            <StatusBadge status={person.status} />
            <span className="text-[12.5px]">
              {person.last_access_at ? `Último acesso ${formatDateTime(person.last_access_at)}` : "Ainda não acessou a plataforma"}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-start gap-2">
            {canEdit && (
              <Link href={`/colaboradores/${person.id}/editar`} className={buttonVariants.primary}>
                <Pencil size={16} aria-hidden /> Editar
              </Link>
            )}
            {person.status !== "inativo" && !person.last_access_at && (
              <span className="inline-flex items-center gap-1.5 self-center rounded-full bg-sunken px-3 py-1 text-[12.5px] text-muted" title="Acesso liberado para a conta Google deste e-mail">
                <Mail size={14} aria-hidden /> Ainda não entrou
              </span>
            )}
            {canDeactivate &&
              (person.status === "inativo" ? (
                <ActionButton action={setProfileStatus} hidden={{ id: person.id, status: "ativo" }} label="Reativar" icon={<UserCheck size={15} aria-hidden />} variant="secondary" />
              ) : (
                <ActionButton
                  action={setProfileStatus}
                  hidden={{ id: person.id, status: "inativo" }}
                  label="Desativar"
                  variant="danger"
                  icon={<UserX size={15} aria-hidden />}
                  confirm
                  confirmLabel="Desativar acesso"
                  confirmText="A pessoa perde o acesso na hora. O histórico e o cadastro ficam guardados e o acesso pode ser reativado."
                />
              ))}
          </div>
        }
      />
      {(aviso === "cadastrado" || aviso === "convidado") && <PageNotice message={`Colaborador cadastrado. O acesso está liberado: ${person.email} já pode entrar com a conta Google desse e-mail.`} />}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <Card title="Dados pessoais e profissionais" icon={IdCard}>
          <div className="flex flex-wrap items-start gap-5">
            <Avatar name={person.full_name} path={person.avatar_path} size={72} />
            <dl className="grid flex-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              {[
                ["Área", person.area?.name],
                ["Cargo", person.position?.name],
                ["Nível", person.level?.name ? <LevelBadge name={person.level.name} /> : null],
                ["Supervisor", person.supervisor?.full_name],
                ["Admissão", formatDate(person.admission_date)],
                ["Início do onboarding", formatDate(person.onboarding_start_date)],
              ].map(([k, v]) => (
                <div key={String(k)} className="grid gap-0.5">
                  <dt className="text-[12.5px] text-muted">{k}</dt>
                  <dd className="font-medium">{v || "Não definido"}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>
        <Card title="Acesso" icon={ShieldCheck}>
          <dl className="grid gap-3">
            <div className="grid gap-0.5">
              <dt className="text-[12.5px] text-muted">Perfil de acesso</dt>
              <dd className="font-medium">{person.role?.name ?? "—"}</dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-[12.5px] text-muted">Status</dt>
              <dd><StatusBadge status={person.status} /></dd>
            </div>
            {perms && (
              <div className="grid gap-1">
                <dt className="text-[12.5px] text-muted">Ajustes individuais de permissão</dt>
                <dd className="flex flex-wrap gap-1">
                  {custom.length === 0 ? (
                    <span className="text-[13px]">Nenhum: segue o perfil.</span>
                  ) : (
                    custom.map(([k, v]) => (
                      <Badge key={k} tone={v ? "ok" : "danger"}>
                        {v ? "Liberado" : "Bloqueado"}: {perms.permissions.find((p) => p.key === k)?.name ?? k}
                      </Badge>
                    ))
                  )}
                </dd>
              </div>
            )}
          </dl>
        </Card>
      </div>
      {isSelf && <Alert tone="brand">Este é o seu cadastro. Por segurança, você não pode alterar o próprio perfil de acesso, suas permissões nem se desativar.</Alert>}

      <LearningCard profileId={person.id} canManageTracks={can(me, P.trilhasMatricular)} />
      <Link href="/colaboradores" className="hide-in-modal text-[13px] font-medium text-accent hover:underline">← Voltar para a lista</Link>
    </>
  );
}
