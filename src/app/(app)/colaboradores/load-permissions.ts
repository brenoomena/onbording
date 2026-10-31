import { createClient } from "@/lib/supabase/server";
import type { PermissionInfo } from "./permission-matrix";

/** Catálogo de permissões, o que o perfil da pessoa concede e os ajustes individuais dela. */
export async function loadPersonPermissions(profileId: string, roleId: string) {
  const supabase = await createClient();
  const [{ data: catalog }, { data: grants }, { data: overrides }] = await Promise.all([
    supabase.from("permissions").select("key, module, name, description").order("sort_order"),
    supabase.from("role_permissions").select("permission_key").eq("role_id", roleId),
    supabase.from("user_permissions").select("permission_key, allowed").eq("profile_id", profileId),
  ]);
  return {
    permissions: (catalog ?? []) as PermissionInfo[],
    roleGrants: (grants ?? []).map((g) => g.permission_key as string),
    overrides: Object.fromEntries((overrides ?? []).map((o) => [o.permission_key as string, o.allowed as boolean])) as Record<string, boolean>,
  };
}
