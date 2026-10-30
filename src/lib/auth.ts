import { cache } from "react";
import { redirect } from "next/navigation";
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

/** Exige ao menos uma das permissões; senão mostra "sem acesso". */
export async function requirePermission(...anyOf: PermissionKey[]) {
  const me = await requireUser();
  if (!anyOf.some((p) => me.permissions.has(p))) redirect("/sem-acesso");
  return me;
}

export function can(me: CurrentUser, perm: PermissionKey): boolean {
  return me.permissions.has(perm);
}
