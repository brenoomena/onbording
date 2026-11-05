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

/** Envia as respostas de uma avaliação. A correção é feita no banco (submit_quiz). */
export async function submitQuiz(
  contentId: string,
  answers: Record<string, { options?: string[]; text?: string }>,
): Promise<ActionState & { status?: "em_correcao" | "aprovada" | "reprovada"; score?: number }> {
  await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(contentId)) return { error: "Avaliação inválida." };
  const clean: Record<string, { options: string[]; text: string }> = {};
  for (const [qid, a] of Object.entries(answers ?? {})) {
    if (!/^[0-9a-f-]{36}$/i.test(qid)) continue;
    clean[qid] = {
      options: Array.isArray(a?.options) ? a.options.filter((o) => typeof o === "string").slice(0, 10) : [],
      text: typeof a?.text === "string" ? a.text.slice(0, 5000) : "",
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_quiz", { p_content: contentId, p_answers: clean });
  if (error) return { error: friendlyError(error, "Não foi possível enviar as respostas.") };
  await revalidatePath(`/estudar/${contentId}`);
  await revalidatePath("/minhas-trilhas", "layout");
  await revalidatePath("/painel");
  const r = data as { status: "em_correcao" | "aprovada" | "reprovada"; score: number };
  return { ok: "Respostas enviadas.", status: r.status, score: Number(r.score) };
}
