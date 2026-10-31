"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { denyUnless, denyUnlessAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { P } from "@/lib/permissions";
import { fromZod, formObject, type ActionState } from "@/lib/action-state";
import { roleKeyFromName, roleSchema } from "@/lib/validation";

export async function createRole(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const parsed = roleSchema.safeParse(formObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .insert({ ...parsed.data, key: roleKeyFromName(parsed.data.name) })
    .select("id")
    .single();
  if (error) return { error: friendlyError(error) };
  revalidatePath("/perfis");
  redirect(`/perfis/${data.id}?aviso=criado`);
}

export async function saveRole(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const id = String(fd.get("id") ?? "");
  const parsed = roleSchema.safeParse(formObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const wanted = new Set(fd.getAll("permissions").map(String));

  const supabase = await createClient();
  const { data: role } = await supabase.from("roles").select("id, key").eq("id", id).single();
  if (!role) return { error: "Perfil não encontrado." };

  const { error: upErr } = await supabase.from("roles").update(parsed.data).eq("id", id);
  if (upErr) return { error: friendlyError(upErr) };

  // O perfil Administrador é fixo (sempre tem todas as permissões).
  if (role.key !== "admin") {
    const { data: links } = await supabase.from("role_permissions").select("permission_key").eq("role_id", id);
    const current = new Set((links ?? []).map((l) => l.permission_key as string));
    const toAdd = [...wanted].filter((k) => !current.has(k));
    const toRemove = [...current].filter((k) => !wanted.has(k));
    if (toRemove.length) {
      const { error } = await supabase.from("role_permissions").delete().eq("role_id", id).in("permission_key", toRemove);
      if (error) return { error: friendlyError(error) };
    }
    if (toAdd.length) {
      const { error } = await supabase.from("role_permissions").insert(toAdd.map((permission_key) => ({ role_id: id, permission_key })));
      if (error) return { error: friendlyError(error) };
    }
  }

  revalidatePath("/perfis");
  revalidatePath(`/perfis/${id}`);
  return { ok: "Perfil salvo. As novas permissões valem a partir do próximo carregamento de página de cada pessoa." };
}

export async function deleteRole(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const supabase = await createClient();
  const { data, error } = await supabase.from("roles").delete().eq("id", String(fd.get("id"))).select("id");
  if (error) {
    return {
      error: error.code === "23503" ? "Há colaboradores com este perfil. Mude o perfil deles antes de excluir." : friendlyError(error),
    };
  }
  if (!data?.length) return { error: "Perfil não encontrado." };
  revalidatePath("/perfis");
  if (fd.get("voltar") === "1") redirect("/perfis");
  return { ok: "Perfil excluído." };
}
