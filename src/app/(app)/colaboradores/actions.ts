"use server";

import { revalidatePath } from "@/lib/revalidate";

import { denyUnless, denyUnlessAdmin, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { friendlyError } from "@/lib/errors";
import { P } from "@/lib/permissions";
import { fromZod, formObject, type ActionState } from "@/lib/action-state";
import { profileCreateSchema, profileUpdateSchema } from "@/lib/validation";

const inviteRedirect = () => `${publicEnv.siteUrl}/auth/confirm?next=/definir-senha`;

/** Procura um usuário de login já existente pelo e-mail (ex.: entrou com Google antes de ser cadastrado). */
async function findAuthUserId(email: string): Promise<string | null> {
  const admin = createAdminClient();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

export async function createProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.colaboradoresCriar);
  if (denied) return denied;
  const parsed = profileCreateSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const { email, ...fields } = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (existing) return { error: "Já existe um colaborador com esse e-mail.", fieldErrors: { email: "E-mail já cadastrado." } };

  // 1. Cria o login e envia o convite (única operação com a chave service_role).
  const admin = createAdminClient();
  let userId: string | null = null;
  let createdNow = false;
  const invite = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: inviteRedirect(),
    data: { full_name: fields.full_name },
  });
  if (invite.data.user) {
    userId = invite.data.user.id;
    createdNow = true;
  } else if (invite.error?.code === "email_exists" || /already been registered/i.test(invite.error?.message ?? "")) {
    userId = await findAuthUserId(email);
  }
  if (!userId) {
    return {
      error:
        invite.error?.code === "over_email_send_rate_limit"
          ? "Limite de envio de e-mails atingido. Aguarde alguns minutos ou configure um provedor de e-mail no Supabase."
          : "Não foi possível enviar o convite. Confira o e-mail e a configuração de envio do Supabase.",
    };
  }

  // 2. Cria o cadastro com a sessão de quem está cadastrando (RLS e travas do banco valem).
  const { error } = await supabase.from("profiles").insert({ id: userId, email, ...fields });
  if (error) {
    if (createdNow) await admin.auth.admin.deleteUser(userId);
    return { error: friendlyError(error) };
  }

  await revalidatePath("/colaboradores");
  return { redirectTo: `/colaboradores/${userId}?aviso=convidado` };
}

export async function updateProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.colaboradoresEditar);
  if (denied) return denied;
  const id = String(formData.get("id") ?? "");
  const parsed = profileUpdateSchema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").update(parsed.data).eq("id", id).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Você não tem permissão para editar este colaborador." };

  await revalidatePath("/colaboradores");
  await revalidatePath(`/colaboradores/${id}`);
  await revalidatePath(`/colaboradores/${id}/editar`);
  return { ok: "Alterações salvas." };
}

export async function setProfileStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.colaboradoresDesativar);
  if (denied) return denied;
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["onboarding", "ativo", "inativo"].includes(status)) return { error: "Status inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").update({ status }).eq("id", id).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Você não tem permissão para alterar este colaborador." };

  await revalidatePath("/colaboradores");
  await revalidatePath(`/colaboradores/${id}`);
  return { ok: status === "inativo" ? "Colaborador desativado." : "Colaborador reativado." };
}

export async function resendInvite(_: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.colaboradoresCriar, P.colaboradoresEditar);
  if (denied) return denied;
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { data: person } = await supabase.from("profiles").select("email, status").eq("id", id).maybeSingle();
  if (!person) return { error: "Colaborador não encontrado." };
  if (person.status === "inativo") return { error: "Reative o colaborador antes de reenviar o acesso." };

  const admin = createAdminClient();
  const invite = await admin.auth.admin.inviteUserByEmail(person.email, { redirectTo: inviteRedirect() });
  if (invite.error) {
    // Quem já aceitou o convite recebe um link para criar nova senha.
    const reset = await supabase.auth.resetPasswordForEmail(person.email, { redirectTo: inviteRedirect() });
    if (reset.error) return { error: "Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos." };
    return { ok: `Enviamos para ${person.email} um link para criar uma nova senha.` };
  }
  return { ok: `Convite reenviado para ${person.email}.` };
}

/**
 * Ajustes individuais de permissão (somente Administrador). O banco também
 * confere: só admin grava, ninguém ajusta as próprias permissões, e a
 * auditoria registra cada mudança.
 */
export async function saveUserPermissions(_: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const profileId = String(formData.get("profile_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) return { error: "Colaborador inválido." };

  const supabase = await createClient();
  const { data: catalog } = await supabase.from("permissions").select("key");
  const keys = new Set((catalog ?? []).map((p) => p.key as string));

  const wanted = new Map<string, boolean>();
  for (const [name, value] of formData.entries()) {
    if (!name.startsWith("perm:")) continue;
    const key = name.slice(5);
    if (!keys.has(key)) continue;
    if (value === "liberar") wanted.set(key, true);
    else if (value === "bloquear") wanted.set(key, false);
  }

  const { data: current, error: readError } = await supabase.from("user_permissions").select("permission_key, allowed").eq("profile_id", profileId);
  if (readError) return { error: friendlyError(readError) };
  const toDelete = (current ?? []).filter((c) => !wanted.has(c.permission_key)).map((c) => c.permission_key as string);
  const toUpsert = [...wanted.entries()]
    .filter(([k, v]) => !(current ?? []).some((c) => c.permission_key === k && c.allowed === v))
    .map(([permission_key, allowed]) => ({ profile_id: profileId, permission_key, allowed }));

  if (toDelete.length) {
    const { error } = await supabase.from("user_permissions").delete().eq("profile_id", profileId).in("permission_key", toDelete);
    if (error) return { error: friendlyError(error) };
  }
  if (toUpsert.length) {
    const { error } = await supabase.from("user_permissions").upsert(toUpsert, { onConflict: "profile_id,permission_key" });
    if (error) return { error: friendlyError(error) };
  }

  await revalidatePath(`/colaboradores/${profileId}`);
  await revalidatePath(`/colaboradores/${profileId}/editar`);
  return { ok: toDelete.length + toUpsert.length ? "Permissões salvas. Valem a partir da próxima tela que a pessoa abrir." : "Nenhuma alteração." };
}
