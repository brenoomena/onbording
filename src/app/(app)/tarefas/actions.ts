"use server";

import { kickEmails } from "@/lib/email/send";
import { denyUnless, requireUser } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";
import { friendlyError } from "@/lib/errors";
import { P } from "@/lib/permissions";
import { revalidatePath } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const KINDS = ["rh", "supervisor", "colaborador", "pessoa"] as const;

async function refresh(profileId?: string | null) {
  await revalidatePath("/tarefas");
  await revalidatePath("/painel");
  if (profileId && isId(profileId)) await revalidatePath(`/colaboradores/${profileId}`);
}

/** Marca ou desmarca uma tarefa (o banco confere se a pessoa pode). */
export async function toggleTask(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const id = fd.get("id");
  if (!isId(id)) return { error: "Tarefa inválida." };
  const done = fd.get("done") === "1";
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_task_done", { p_task: id, p_done: done });
  if (error) return { error: friendlyError(error) };
  await refresh(String(fd.get("profile_id") ?? ""));
  return { ok: done ? "Tarefa concluída." : "Tarefa reaberta." };
}

/** RH: aplica um modelo a uma pessoa. */
export async function applyChecklist(_: ActionState, fd: FormData): Promise<ActionState> {
  kickEmails();
  const denied = await denyUnless(P.checklistsGerenciar);
  if (denied) return denied;
  const tpl = fd.get("template_id");
  const person = fd.get("profile_id");
  if (!isId(tpl)) return { error: "Escolha um modelo de checklist." };
  if (!isId(person)) return { error: "Pessoa inválida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_checklist", { p_template: tpl, p_profile: person });
  if (error) return { error: friendlyError(error) };
  await refresh(person);
  return { ok: "Checklist aplicado. Os responsáveis foram avisados." };
}

/** RH: tira um checklist da pessoa (as tarefas somem junto). */
export async function removeChecklist(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.checklistsGerenciar);
  if (denied) return denied;
  const id = fd.get("id");
  if (!isId(id)) return { error: "Checklist inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("onboarding_checklists").delete().eq("id", id).select("profile_id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Checklist não encontrado." };
  await refresh(data[0].profile_id as string);
  return { ok: "Checklist removido." };
}

/** RH: tarefa avulsa num checklist da pessoa. */
export async function addTask(_: ActionState, fd: FormData): Promise<ActionState> {
  kickEmails();
  const denied = await denyUnless(P.checklistsGerenciar);
  if (denied) return denied;
  const checklist = fd.get("checklist_id");
  const profile = fd.get("profile_id");
  const title = String(fd.get("title") ?? "").replace(/\s+/g, " ").trim();
  const kind = String(fd.get("responsible_kind") ?? "rh") as (typeof KINDS)[number];
  const person = fd.get("responsible_id");
  const due = String(fd.get("due_date") ?? "");
  const fieldErrors: Record<string, string> = {};
  if (!isId(checklist) || !isId(profile)) return { error: "Checklist inválido." };
  if (title.length < 2 || title.length > 160) fieldErrors.title = "Escreva o nome da tarefa (até 160 caracteres).";
  if (!KINDS.includes(kind)) fieldErrors.responsible_kind = "Escolha o responsável.";
  if (kind === "pessoa" && !isId(person)) fieldErrors.responsible_id = "Escolha a pessoa responsável.";
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) fieldErrors.due_date = "Data inválida.";
  if (Object.keys(fieldErrors).length) return { error: Object.values(fieldErrors)[0], fieldErrors };
  const supabase = await createClient();
  const { count } = await supabase.from("onboarding_tasks").select("id", { count: "exact", head: true }).eq("checklist_id", checklist);
  const { error } = await supabase.from("onboarding_tasks").insert({
    checklist_id: checklist,
    profile_id: profile,
    position: count ?? 0,
    title,
    responsible_kind: kind,
    responsible_id: kind === "colaborador" ? profile : kind === "pessoa" ? person : null,
    due_date: due || null,
  });
  if (error) return { error: friendlyError(error) };
  await refresh(profile);
  return { ok: "Tarefa incluída. O responsável foi avisado." };
}

/** RH: muda o prazo de uma tarefa. */
export async function updateTaskDue(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.checklistsGerenciar);
  if (denied) return denied;
  const id = fd.get("id");
  const due = String(fd.get("due_date") ?? "");
  if (!isId(id)) return { error: "Tarefa inválida." };
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: "Data inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("onboarding_tasks").update({ due_date: due || null }).eq("id", id).select("profile_id");
  if (error) return { error: friendlyError(error) };
  await refresh(data?.[0]?.profile_id as string | undefined);
  return { ok: "Prazo atualizado." };
}

/** RH: exclui uma tarefa. */
export async function deleteTask(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.checklistsGerenciar);
  if (denied) return denied;
  const id = fd.get("id");
  if (!isId(id)) return { error: "Tarefa inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("onboarding_tasks").delete().eq("id", id).select("profile_id");
  if (error) return { error: friendlyError(error) };
  await refresh(data?.[0]?.profile_id as string | undefined);
  return { ok: "Tarefa excluída." };
}
