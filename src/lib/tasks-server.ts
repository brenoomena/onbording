import "server-only";
import type { CurrentUser } from "@/lib/auth";
import type { ResponsibleKind } from "@/lib/checklist";
import { P } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export interface TaskRowData {
  id: string;
  checklist_id: string;
  profile_id: string;
  position: number;
  title: string;
  description: string | null;
  responsible_kind: ResponsibleKind;
  responsible_id: string | null;
  due_date: string | null;
  done_at: string | null;
  note: string | null;
  person: { id: string; full_name: string; supervisor_id: string | null } | null;
  responsible: { id: string; full_name: string } | null;
  doneBy: { id: string; full_name: string } | null;
  checklist: { id: string; name: string } | null;
}

export const TASK_SELECT =
  "id, checklist_id, profile_id, position, title, description, responsible_kind, responsible_id, due_date, done_at, note, " +
  "person:profiles!onboarding_tasks_profile_id_fkey(id, full_name, supervisor_id), " +
  "responsible:profiles!onboarding_tasks_responsible_id_fkey(id, full_name), " +
  "doneBy:profiles!onboarding_tasks_done_by_fkey(id, full_name), " +
  "checklist:onboarding_checklists(id, name)";

/** Mesma regra do banco (task_recipients): quem responde pela tarefa agora. */
export function isMine(t: TaskRowData, me: CurrentUser): boolean {
  const rh = me.permissions.has(P.checklistsGerenciar);
  if (t.responsible_kind === "colaborador" || t.responsible_kind === "pessoa") return t.responsible_id === me.userId;
  if (t.responsible_kind === "supervisor") return t.person?.supervisor_id ? t.person.supervisor_id === me.userId : rh;
  return rh;
}

/** O RH pode marcar qualquer tarefa; os outros, só as próprias. */
export function canHandle(t: TaskRowData, me: CurrentUser): boolean {
  return me.permissions.has(P.checklistsGerenciar) || isMine(t, me);
}

/** Quem responde, em texto ("RH", "Supervisor: Sérgio", "Tiago TI"). */
export function responsibleText(t: TaskRowData): string {
  switch (t.responsible_kind) {
    case "rh":
      return "RH";
    case "colaborador":
      return "O colaborador";
    case "supervisor":
      return t.person?.supervisor_id ? "Supervisor" : "Supervisor (sem supervisor: RH)";
    default:
      return t.responsible?.full_name ?? (t.responsible_id ? "Outra pessoa da equipe (ex.: TI)" : "Pessoa removida");
  }
}

export async function loadTasks(filter: { profileId?: string; openOnly?: boolean; doneSince?: string }): Promise<TaskRowData[]> {
  const supabase = await createClient();
  let q = supabase.from("onboarding_tasks").select(TASK_SELECT).order("due_date", { ascending: true, nullsFirst: false }).order("position").limit(500);
  if (filter.profileId) q = q.eq("profile_id", filter.profileId);
  if (filter.openOnly) q = q.is("done_at", null);
  if (filter.doneSince) q = q.or(`done_at.is.null,done_at.gte.${filter.doneSince}`);
  const { data } = await q;
  return (data ?? []) as unknown as TaskRowData[];
}
