import { KeyRound, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { Alert, Card, PageHeader } from "@/components/ui";
import { can, isAdmin, requirePermission } from "@/lib/auth";
import { P } from "@/lib/permissions";
import { PROFILE_SELECT, loadStructure, loadSupervisorOptions, type ProfileRow } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { saveUserPermissions, updateProfile } from "../../actions";
import { loadPersonPermissions } from "../../load-permissions";
import { PermissionMatrix } from "../../permission-matrix";
import { ProfileForm } from "../../profile-form";

export const metadata: Metadata = { title: "Editar colaborador" };

export default async function EditarColaboradorPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission(P.colaboradoresEditar);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();
  const person = data as unknown as ProfileRow;

  const admin = isAdmin(me);
  const isSelf = person.id === me.userId;
  const targetIsAdmin = person.role?.key === "admin";
  // O cadastro de um administrador só é editado por administradores (o banco também bloqueia).
  if (targetIsAdmin && !admin) forbidden();

  const [structure, supervisors, perms] = await Promise.all([
    loadStructure(),
    loadSupervisorOptions(),
    admin && !isSelf && !targetIsAdmin ? loadPersonPermissions(person.id, person.role_id) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Colaboradores"
        icon={Pencil}
        title={`Editar ${person.full_name}`}
        description="Dados, perfil de acesso, status e permissões individuais."
        actions={<Link href={`/colaboradores/${person.id}`} className="text-[13px] font-medium text-accent hover:underline">← Voltar ao cadastro</Link>}
      />
      {isSelf && <Alert tone="brand">Este é o seu cadastro. Por segurança, você não pode alterar o próprio perfil de acesso, suas permissões nem se desativar.</Alert>}

      <Card>
        <ProfileForm
          mode="edit"
          action={updateProfile}
          structure={structure}
          supervisors={supervisors}
          canChangeRole={admin && !isSelf}
          canDeactivate={can(me, P.colaboradoresDesativar) && !isSelf}
          values={person}
        />
      </Card>

      {admin && (
        <Card
          title="Permissões por módulo e ação"
          description="O perfil define o padrão. Libere ou bloqueie ações só para esta pessoa. Somente administradores ajustam permissões."
          icon={KeyRound}
        >
          {perms ? (
            <PermissionMatrix
              profileId={person.id}
              roleName={person.role?.name ?? "—"}
              permissions={perms.permissions}
              roleGrants={perms.roleGrants}
              overrides={perms.overrides}
              action={saveUserPermissions}
            />
          ) : (
            <p className="text-[13px] text-muted">
              {targetIsAdmin
                ? "Administradores têm sempre todas as permissões."
                : "Você não pode ajustar as suas próprias permissões. Peça a outro administrador."}
            </p>
          )}
        </Card>
      )}
    </>
  );
}
