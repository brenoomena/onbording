"use server";

import { revalidatePath } from "@/lib/revalidate";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import type { ActionState } from "@/lib/action-state";

export async function completeContent(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const contentId = String(fd.get("content_id"));
  const mode = fd.get("mode") === "externa_declarada" ? "externa_declarada" : "confirmada";
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_content", { p_content: contentId, p_mode: mode });
  if (error) return { error: friendlyError(error, "Não foi possível registrar a conclusão.") };
  await revalidatePath(`/estudar/${contentId}`);
  await revalidatePath("/minhas-trilhas", "layout");
  await revalidatePath("/painel");
  return { ok: "Conteúdo concluído." };
}

export async function enrollMe(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("enroll_me", { p_track: String(fd.get("track_id")) });
  if (error) return { error: friendlyError(error, "Não foi possível se inscrever.") };
  await revalidatePath("/minhas-trilhas");
  return { ok: "Inscrição feita. A trilha aparece em Minhas trilhas." };
}
