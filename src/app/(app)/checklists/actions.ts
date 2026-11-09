"use server";

import { kickEmails } from "@/lib/email/send";
import { denyUnless } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";
import { sanitizeItems } from "@/lib/checklist";
import { friendlyError } from "@/lib/errors";
import { P } from "@/lib/permissions";
import { revalidatePath } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { parseAudience } from "@/lib/validation";

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

/** Salva o modelo inteiro (dados, público e tarefas); "publicar" também publica. */
export async function saveTemplate(_: ActionState, fd: FormData): Promise<ActionState> {
  kickEmails();
  const denied = await denyUnless(P.checklistsGerenciar);
  if (denied) return denied;
  const id = String(fd.get("id") ?? "");
  const name = String(fd.get("name") ?? "").replace(/\s+/g, " ").trim();
  const description = String(fd.get("description") ?? "").trim();
  const auto = fd.get("auto_apply") === "on";
  const intent = String(fd.get("intent") ?? "salvar");
  if (name.length < 3 || name.length > 120) return { error: "Dê um nome ao modelo (3 a 120 caracteres).", fieldErrors: { name: "Dê um nome ao modelo (3 a 120 caracteres)." } };
  if (description.length > 1000) return { error: "A descrição passa de 1.000 caracteres." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("items") ?? "[]"));
  } catch {
    return { error: "Não foi possível ler as tarefas." };
  }
  const { items, error: itemsError } = sanitizeItems(raw);
  if (itemsError) return { error: itemsError };
  if (intent === "publicar" && items.length === 0) return { error: "Inclua ao menos uma tarefa antes de publicar." };
  if (id && !isId(id)) return { error: "Modelo inválido." };

  const supabase = await createClient();
  const { data: savedId, error } = await supabase.rpc("save_checklist_template", {
    p_id: id || null,
    p_name: name,
    p_description: description,
    p_auto_apply: auto,
    p_audience: parseAudience(fd),
    p_items: items,
  });
  if (error) return { error: friendlyError(error) };
  const tpl = savedId as string;
  if (intent === "publicar") {
    const { error: pubErr } = await supabase.from("checklist_templates").update({ status: "publicado" }).eq("id", tpl);
    if (pubErr) return { error: `O modelo foi salvo, mas não foi publicado: ${friendlyError(pubErr)}` };
  }
  await revalidatePath("/checklists");
  return { redirectTo: `/checklists/${tpl}?aviso=${intent === "publicar" ? "publicado" : "salvo"}` };
}

/** Publica, volta para rascunho ou arquiva. */
export async function setTemplateStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  kickEmails();
  const denied = await denyUnless(P.checklistsGerenciar);
  if (denied) return denied;
  const id = fd.get("id");
  const status = String(fd.get("status") ?? "");
  if (!isId(id) || !["rascunho", "publicado", "arquivado"].includes(status)) return { error: "Pedido inválido." };
  const supabase = await createClient();
  if (status === "publicado") {
    const { count } = await supabase.from("checklist_template_items").select("id", { count: "exact", head: true }).eq("template_id", id);
    if (!count) return { error: "Inclua ao menos uma tarefa antes de publicar." };
  }
  const { error } = await supabase.from("checklist_templates").update({ status }).eq("id", id);
  if (error) return { error: friendlyError(error) };
  await revalidatePath("/checklists");
  await revalidatePath(`/checklists/${id}`);
  return {
    ok:
      status === "publicado"
        ? "Modelo publicado. Quem está em onboarding e atende ao público já recebeu o checklist."
        : status === "arquivado"
          ? "Modelo arquivado. Os checklists já criados continuam com as pessoas."
          : "Modelo voltou para rascunho: deixa de ser aplicado automaticamente.",
  };
}

/** Exclui um modelo que nunca foi aplicado. */
export async function deleteTemplate(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.checklistsGerenciar);
  if (denied) return denied;
  const id = fd.get("id");
  if (!isId(id)) return { error: "Modelo inválido." };
  const supabase = await createClient();
  const { count } = await supabase.from("onboarding_checklists").select("id", { count: "exact", head: true }).eq("template_id", id);
  if (count) return { error: "Este modelo já foi aplicado a pessoas. Arquive em vez de excluir." };
  const { error } = await supabase.from("checklist_templates").delete().eq("id", id);
  if (error) return { error: friendlyError(error) };
  await revalidatePath("/checklists");
  return { redirectTo: "/checklists?aviso=excluido" };
}
