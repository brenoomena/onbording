"use server";

import { requireUser } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";
import { friendlyError } from "@/lib/errors";
import { CONTENT_COMMENT_MAX, TRACK_COMMENT_MAX, cleanComment, parseRating } from "@/lib/feedback";
import { revalidatePath } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

/** A pessoa avalia a trilha que concluiu (pode mudar a nota depois). */
export async function submitTrackFeedback(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const track = fd.get("track_id");
  if (!isId(track)) return { error: "Trilha inválida." };
  const rating = parseRating(fd.get("rating"));
  if (!rating) return { error: "Escolha uma nota de 1 a 5 estrelas.", fieldErrors: { rating: "Escolha uma nota." } };
  const comment = cleanComment(fd.get("comment"), TRACK_COMMENT_MAX);
  if (comment.error) return { error: comment.error, fieldErrors: { comment: comment.error } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_track_feedback", {
    p_track: track,
    p_rating: rating,
    p_comment: comment.value,
    p_anonymous: fd.get("anonymous") === "on",
  });
  if (error) return { error: friendlyError(error) };
  await revalidatePath(`/minhas-trilhas/${track}`);
  await revalidatePath("/pesquisa");
  return { ok: "Obrigado! Sua avaliação foi registrada." };
}

/** Avaliação de um conteúdo concluído. */
export async function submitContentFeedback(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const content = fd.get("content_id");
  if (!isId(content)) return { error: "Conteúdo inválido." };
  const rating = parseRating(fd.get("rating"));
  if (!rating) return { error: "Escolha uma nota de 1 a 5 estrelas.", fieldErrors: { rating: "Escolha uma nota." } };
  const comment = cleanComment(fd.get("comment"), CONTENT_COMMENT_MAX);
  if (comment.error) return { error: comment.error, fieldErrors: { comment: comment.error } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_content_feedback", {
    p_content: content,
    p_rating: rating,
    p_comment: comment.value,
    p_anonymous: fd.get("anonymous") === "on",
  });
  if (error) return { error: friendlyError(error) };
  await revalidatePath(`/estudar/${content}`);
  await revalidatePath("/pesquisa");
  return { ok: "Obrigado pela avaliação!" };
}
