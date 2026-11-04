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
