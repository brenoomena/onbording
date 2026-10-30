"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { passwordSchema } from "@/lib/validation";
import { fromZod, type ActionState } from "@/lib/action-state";

export async function updateMyName(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = z.string().trim().min(3, "Informe o nome completo.").max(120).safeParse(String(fd.get("full_name") ?? ""));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_profile", { p_full_name: parsed.data });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { ok: "Nome atualizado." };
}

export async function changeMyPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = passwordSchema.safeParse({ password: String(fd.get("password") ?? ""), confirm: String(fd.get("confirm") ?? "") });
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "A nova senha precisa ser diferente da atual."
          : error.code === "reauthentication_needed"
            ? "Por segurança, saia e entre de novo antes de trocar a senha."
            : "Não foi possível trocar a senha agora.",
    };
  }
  return { ok: "Senha alterada." };
}

/** Grava o novo caminho da foto e apaga a anterior. */
export async function setMyAvatar(path: string): Promise<ActionState> {
  const me = await requireUser();
  if (typeof path !== "string" || !path.startsWith(`${me.userId}/`)) return { error: "Arquivo de foto inválido." };
  const supabase = await createClient();
  const { data: old, error } = await supabase.rpc("set_my_avatar", { p_path: path });
  if (error) return { error: friendlyError(error) };
  if (old && old !== path) await supabase.storage.from("avatars").remove([old as string]);
  revalidatePath("/", "layout");
  return { ok: "Foto atualizada." };
}

export async function removeMyAvatar(): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { data: old, error } = await supabase.rpc("set_my_avatar", { p_path: null });
  if (error) return { error: friendlyError(error) };
  if (old) await supabase.storage.from("avatars").remove([old as string]);
  revalidatePath("/", "layout");
  return { ok: "Foto removida." };
}
