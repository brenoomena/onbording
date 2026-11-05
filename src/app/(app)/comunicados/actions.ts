"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "@/lib/revalidate";
import { denyUnless } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { P } from "@/lib/permissions";
import type { ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";
import { parseAudience } from "@/lib/validation";

const isId = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

/** Salva o comunicado (rascunho) e, se pedido, publica para o público escolhido. */
export async function saveAnnouncement(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.comunicadosGerenciar);
  if (denied) return denied;
  const id = String(fd.get("id") ?? "");
  const title = String(fd.get("title") ?? "").replace(/\s+/g, " ").trim();
  const body = String(fd.get("body") ?? "").trim();
  const importance = fd.get("importance") === "importante" ? "importante" : "normal";
  const publish = fd.get("intent") === "publicar";
  const fieldErrors: Record<string, string> = {};
  if (title.length < 3) fieldErrors.title = "Escreva um título com pelo menos 3 caracteres.";
  if (title.length > 140) fieldErrors.title = "Use no máximo 140 caracteres.";
  if (!body) fieldErrors.body = "Escreva a mensagem.";
  if (body.length > 10000) fieldErrors.body = "Use no máximo 10.000 caracteres.";
  if (Object.keys(fieldErrors).length) return { error: Object.values(fieldErrors)[0], fieldErrors };
  const rules = parseAudience(fd);

  const supabase = await createClient();
  let annId = id;
  if (id) {
    if (!isId(id)) return { error: "Comunicado inválido." };
    const { data, error } = await supabase.from("announcements").update({ title, body, importance }).eq("id", id).eq("status", "rascunho").select("id");
    if (error) return { error: friendlyError(error) };
    if (!data?.length) return { error: "Só é possível editar comunicados em rascunho." };
  } else {
    const { data: auth } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("announcements").insert({ title, body, importance, created_by: auth.user?.id }).select("id").single();
    if (error) return { error: friendlyError(error) };
    annId = data.id;
  }
  const { error: delErr } = await supabase.from("announcement_audience").delete().eq("announcement_id", annId);
  if (delErr) return { error: friendlyError(delErr) };
  if (rules.length) {
    const { error } = await supabase.from("announcement_audience").insert(rules.map((r) => ({ ...r, announcement_id: annId })));
    if (error) return { error: friendlyError(error) };
  }

  await revalidatePath("/comunicados");
  if (publish) {
    const { data: n, error } = await supabase.rpc("publish_announcement", { p_id: annId });
    if (error) return { error: `O rascunho foi salvo, mas não foi possível publicar: ${friendlyError(error)}` };
    return { redirectTo: `/comunicados/${annId}?aviso=publicado&n=${Number(n ?? 0)}` };
  }
  if (!id) return { redirectTo: `/comunicados/${annId}/editar?aviso=salvo` };
  return { ok: "Rascunho salvo. Ainda não foi enviado para ninguém." };
}

export async function archiveAnnouncement(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.comunicadosGerenciar);
  if (denied) return denied;
  const id = String(fd.get("id") ?? "");
  if (!isId(id)) return { error: "Comunicado inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").update({ status: "arquivado" }).eq("id", id);
  if (error) return { error: friendlyError(error) };
  await revalidatePath("/comunicados");
  // O botão some com o arquivamento: o aviso vai pela página (redirect do servidor).
  redirect(`/comunicados/${id}?aviso=arquivado`);
}

export async function deleteAnnouncement(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.comunicadosGerenciar);
  if (denied) return denied;
  const id = String(fd.get("id") ?? "");
  if (!isId(id)) return { error: "Comunicado inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("announcements").delete().eq("id", id).eq("status", "rascunho").select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Só rascunhos podem ser excluídos. Comunicados enviados podem ser arquivados." };
  await revalidatePath("/comunicados");
  return { redirectTo: "/comunicados?aba=gerenciar" };
}
