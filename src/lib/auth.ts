import { cache } from "react";
import { forbidden, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PermissionKey } from "@/lib/permissions";
import type { Profile, Role } from "@/lib/types";

export interface CurrentUser {
  userId: string;
  email: string;
  profile: (Profile & { role: Pick<Role, "key" | "name"> }) | null;
  permissions: Set<string>;
}

/** Usuário da requisição atual, com perfil e permissões (uma consulta por requisição). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: perms }] = await Promise.all([
    supabase.from("profiles").select("*, role:roles(key, name)").eq("id", user.id).maybeSingle(),
    supabase.rpc("my_permissions"),
  ]);

  return {
    userId: user.id,
    email: user.email ?? "",
    profile: (profile as CurrentUser["profile"]) ?? null,
    permissions: new Set<string>((perms as string[] | null) ?? []),
  };
});

/** Exige login e cadastro ativo; senão redireciona. */
export async function requireUser(): Promise<CurrentUser & { profile: NonNullable<CurrentUser["profile"]> }> {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!me.profile) redirect("/acesso-pendente");
  if (me.profile.status === "inativo") redirect("/acesso-pendente?motivo=inativo");
  return me as CurrentUser & { profile: NonNullable<CurrentUser["profile"]> };
}

/** Exige ao menos uma das permissões; senão responde 403 (página "sem acesso"). */
export async function requirePermission(...anyOf: PermissionKey[]) {
  const me = await requireUser();
  if (!anyOf.some((p) => me.permissions.has(p))) forbidden();
  return me;
}

/** Exige o perfil Administrador (configurações, perfis e permissões); senão 403. */
export async function requireAdmin() {
  const me = await requireUser();
  if (!isAdmin(me)) forbidden();
  return me;
}

export function isAdmin(me: CurrentUser): boolean {
  return me.profile?.role.key === "admin" && me.profile.status !== "inativo";
}

export function can(me: CurrentUser, perm: PermissionKey): boolean {
  return me.permissions.has(perm);
}

const DENIED = { error: "Você não tem permissão para esta ação." } as const;

/**
 * Para Server Actions: confere no servidor se a pessoa tem uma das
 * permissões. Devolve o erro a mostrar, ou null quando pode seguir.
 * O banco confere de novo (RLS), então isto é a primeira barreira, não a única.
 */
export async function denyUnless(...anyOf: PermissionKey[]): Promise<{ error: string } | null> {
  const me = await getCurrentUser();
  if (!me?.profile || me.profile.status === "inativo") return { error: "Sua sessão expirou. Entre novamente." };
  return anyOf.some((p) => me.permissions.has(p)) ? null : DENIED;
}

export async function denyUnlessAdmin(): Promise<{ error: string } | null> {
  const me = await getCurrentUser();
  if (!me?.profile || me.profile.status === "inativo") return { error: "Sua sessão expirou. Entre novamente." };
  return isAdmin(me) ? null : { error: "Somente administradores podem fazer isso." };
}
