"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { denyUnless, denyUnlessAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { P } from "@/lib/permissions";
import { fromZod, formObject, type ActionState } from "@/lib/action-state";
import { moduleSchema, parseAudience, trackSchema } from "@/lib/validation";

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

function refresh(trackId?: string) {
  revalidatePath("/trilhas");
  revalidatePath("/minhas-trilhas");
  if (trackId) {
    revalidatePath(`/trilhas/${trackId}`);
    revalidatePath(`/trilhas/${trackId}/matriculas`);
  }
}

// ------------------------------------------------------------------ trilha

export async function saveTrack(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(fd.get("id") ? P.trilhasEditar : P.trilhasCriar);
  if (denied) return denied;
  const raw = formObject(fd);
  const parsed = trackSchema.safeParse({ ...raw, is_mandatory: fd.get("is_mandatory") === "on", is_sequential: fd.get("is_sequential") === "on" });
  if (!parsed.success) return fromZod(parsed.error);
  const id = String(fd.get("id") ?? "");
  const rules = parseAudience(fd);
  const supabase = await createClient();

  let trackId = id;
  if (id) {
    const { error } = await supabase.from("tracks").update(parsed.data).eq("id", id);
    if (error) return { error: friendlyError(error) };
  } else {
    const { data, error } = await supabase.from("tracks").insert(parsed.data).select("id").single();
    if (error) return { error: friendlyError(error) };
    trackId = data.id;
  }

  const { error: delErr } = await supabase.from("audience_rules").delete().eq("track_id", trackId);
  if (delErr) return { error: friendlyError(delErr) };
  if (rules.length) {
    const { error } = await supabase.from("audience_rules").insert(rules.map((r) => ({ ...r, track_id: trackId })));
    if (error) return { error: friendlyError(error) };
  }

  refresh(trackId);
  if (!id) redirect(`/trilhas/${trackId}?aviso=criada`);
  return { ok: "Trilha salva. Se for obrigatória e estiver publicada, quem entrou no público já foi matriculado." };
}

export async function setTrackStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.trilhasEditar);
  if (denied) return denied;
  const id = String(fd.get("id"));
  const status = String(fd.get("status"));
  if (!["rascunho", "publicado", "arquivado"].includes(status)) return { error: "Status inválido." };
  const supabase = await createClient();
  if (status === "publicado") {
    const { count } = await supabase
      .from("module_items")
      .select("id, module:modules!inner(track_id)", { count: "exact", head: true })
      .eq("module.track_id", id);
    if (!count) return { error: "Inclua pelo menos um conteúdo antes de publicar." };
  }
  const { error } = await supabase.from("tracks").update({ status }).eq("id", id);
  if (error) return { error: friendlyError(error) };
  refresh(id);
  return { ok: status === "publicado" ? "Trilha publicada." : status === "arquivado" ? "Trilha arquivada." : "Trilha voltou para rascunho." };
}

export async function deleteTrack(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.trilhasExcluir);
  if (denied) return denied;
  const id = String(fd.get("id"));
  const supabase = await createClient();
  const { data, error } = await supabase.from("tracks").delete().eq("id", id).select("id");
  if (error) {
    if (error.code === "23503") {
      return {
        error: error.message.includes("contents")
          ? "Esta trilha tem conteúdos vinculados. Exclua ou mova os conteúdos para outra trilha antes, ou arquive a trilha."
          : "Esta trilha tem matrículas. Arquive em vez de excluir.",
      };
    }
    return { error: friendlyError(error) };
  }
  if (!data?.length) return { error: "Trilha não encontrada." };
  refresh();
  // Excluída na própria página da trilha: volta para a lista.
  if (fd.get("voltar") === "1") redirect("/trilhas");
  return { ok: "Trilha excluída." };
}

// ------------------------------------------------------------------ módulos

export async function addModule(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.trilhasEditar);
  if (denied) return denied;
  const trackId = String(fd.get("track_id"));
  const parsed = moduleSchema.safeParse(formObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { data: last } = await supabase.from("modules").select("position").eq("track_id", trackId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("modules").insert({ ...parsed.data, track_id: trackId, position: (last?.position ?? 0) + 1 });
  if (error) return { error: friendlyError(error) };
  refresh(trackId);
  return { ok: `Módulo "${parsed.data.title}" criado.` };
}

export async function updateModule(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.trilhasEditar);
  if (denied) return denied;
  const id = String(fd.get("id"));
  const parsed = moduleSchema.safeParse(formObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.from("modules").update(parsed.data).eq("id", id).select("track_id").single();
  if (error) return { error: friendlyError(error) };
  refresh(data.track_id);
  return { ok: "Módulo salvo." };
}

export async function deleteModule(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.trilhasEditar);
  if (denied) return denied;
  const id = String(fd.get("id"));
  const supabase = await createClient();
  const { data, error } = await supabase.from("modules").delete().eq("id", id).select("track_id");
  if (error) return { error: friendlyError(error) };
  refresh(data?.[0]?.track_id);
  return {};
}

export async function moveModule(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.trilhasEditar);
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_module", { p_module: String(fd.get("id")), p_direction: Number(fd.get("direction")) });
  if (error) return { error: friendlyError(error) };
  refresh(String(fd.get("track_id")));
  return {};
}

// ------------------------------------------------------------------ itens

export async function addItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.trilhasEditar);
  if (denied) return denied;
  const moduleId = String(fd.get("module_id"));
  const contentId = fd.get("content_id");
  if (!isId(contentId)) return { error: "Escolha um conteúdo." };
  const supabase = await createClient();
  const { data: last } = await supabase.from("module_items").select("position").eq("module_id", moduleId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("module_items").insert({
    module_id: moduleId,
    content_id: contentId,
    position: (last?.position ?? 0) + 1,
    is_required: fd.get("is_required") === "on",
  });
  if (error) return { error: error.code === "23505" ? "Este conteúdo já está neste módulo." : friendlyError(error) };
  refresh(String(fd.get("track_id")));
  return { ok: "Conteúdo incluído." };
}

export async function toggleRequired(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.trilhasEditar);
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("module_items").update({ is_required: fd.get("value") === "true" }).eq("id", String(fd.get("id")));
  if (error) return { error: friendlyError(error) };
  refresh(String(fd.get("track_id")));
  return {};
}

export async function moveItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.trilhasEditar);
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_module_item", { p_item: String(fd.get("id")), p_direction: Number(fd.get("direction")) });
  if (error) return { error: friendlyError(error) };
  refresh(String(fd.get("track_id")));
  return {};
}

export async function removeItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.trilhasEditar);
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("module_items").delete().eq("id", String(fd.get("id")));
  if (error) return { error: friendlyError(error) };
  refresh(String(fd.get("track_id")));
  return {};
}

// ------------------------------------------------------------------ matrículas

export async function enrollPeople(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.trilhasMatricular);
  if (denied) return denied;
  const me = await requireUser();
  const trackId = String(fd.get("track_id"));
  const people = fd.getAll("profile_id").map(String).filter(isId);
  if (!people.length) return { error: "Escolha pelo menos uma pessoa." };
  const due = String(fd.get("due_date") ?? "");
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollments")
    .upsert(
      people.map((profile_id) => ({ profile_id, track_id: trackId, origin: "manual", assigned_by: me.userId, due_date: dueDate })),
      { onConflict: "profile_id,track_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) return { error: friendlyError(error) };
  refresh(trackId);
  const added = data?.length ?? 0;
  const skipped = people.length - added;
  return { ok: `${added} ${added === 1 ? "pessoa matriculada" : "pessoas matriculadas"}.${skipped ? ` ${skipped} já estava${skipped > 1 ? "m" : ""} matriculada${skipped > 1 ? "s" : ""}.` : ""}` };
}

export async function updateDueDate(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.trilhasMatricular);
  if (denied) return denied;
  const due = String(fd.get("due_date") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollments")
    .update({ due_date: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null })
    .eq("id", String(fd.get("id")))
    .select("track_id")
    .single();
  if (error) return { error: friendlyError(error) };
  refresh(data.track_id);
  return { ok: "Prazo salvo." };
}

export async function removeEnrollment(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.trilhasMatricular);
  if (denied) return denied;
  const supabase = await createClient();
  const { data: e } = await supabase.from("enrollments").select("track_id, status").eq("id", String(fd.get("id"))).maybeSingle();
  if (!e) return { error: "Matrícula não encontrada." };
  if (e.status !== "nao_iniciada") return { error: "Só é possível remover matrículas ainda não iniciadas, para preservar o histórico." };
  const { error } = await supabase.from("enrollments").delete().eq("id", String(fd.get("id")));
  if (error) return { error: friendlyError(error) };
  refresh(e.track_id);
  return {};
}
