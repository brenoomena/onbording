"use server";

import type { ActionState } from "@/lib/action-state";
import { denyUnless } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { P } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

/**
 * Ajusta o prazo de uma matrícula pela lista de atenção. Sem revalidar a
 * página aqui: a tela mostra o aviso e só depois atualiza a lista, porque a
 * linha pode sair dela (deixa de estar em atraso).
 */
export async function ajustarPrazo(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.trilhasMatricular);
  if (denied) return denied;
  const id = String(fd.get("id") ?? "");
  const due = String(fd.get("due_date") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Matrícula inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollments")
    .update({ due_date: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null })
    .eq("id", id)
    .select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Matrícula não encontrada ou sem permissão para alterá-la." };
  return { ok: due ? "Prazo salvo." : "Prazo removido." };
}

/** Correção das respostas abertas de uma tentativa (o banco confere quem pode corrigir). */
export async function corrigirAvaliacao(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.avaliacoesCorrigir);
  if (denied) return denied;
  const id = String(fd.get("attempt_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Tentativa inválida." };
  const grades: Record<string, { awarded: number; comment: string }> = {};
  const fieldErrors: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    const m = /^pts_([0-9a-f-]{36})$/i.exec(k);
    if (!m) continue;
    const raw = String(v).replace(",", ".").trim();
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n)) {
      fieldErrors[k] = "Dê a nota.";
      continue;
    }
    grades[m[1]] = { awarded: Math.round(n * 100) / 100, comment: String(fd.get(`com_${m[1]}`) ?? "").slice(0, 1000) };
  }
  if (Object.keys(fieldErrors).length) return { error: "Dê a nota de todas as respostas abertas.", fieldErrors };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("grade_quiz_attempt", {
    p_attempt: id,
    p_grades: grades,
    p_feedback: String(fd.get("feedback") ?? "").slice(0, 2000),
  });
  if (error) return { error: friendlyError(error, "Não foi possível salvar a correção.") };
  const r = data as { status: string; score: number };
  const result = r.status === "aprovada" ? "aprovada" : "reprovada";
  return { redirectTo: `/acompanhamento?vista=correcoes&aviso=${result}&nota=${Math.round(Number(r.score))}` };
}
