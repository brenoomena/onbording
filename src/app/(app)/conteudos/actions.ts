"use server";

import { revalidatePath } from "@/lib/revalidate";

import { denyUnless, denyUnlessAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { P } from "@/lib/permissions";
import { fromZod, formObject, type ActionState } from "@/lib/action-state";
import { contentSchema, parseAudience } from "@/lib/validation";

export async function saveContent(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(fd.get("id") ? P.conteudosEditar : P.conteudosCriar);
  if (denied) return denied;
  const raw = formObject(fd);
  const parsed = contentSchema.safeParse(raw);
  if (!parsed.success) return fromZod(parsed.error);
  const id = String(fd.get("id") ?? "");
  const isLibrary = fd.get("is_library") === "on";
  // Trilha a que o conteúdo pertence; sem trilha, só como material da Biblioteca.
  const trackRaw = String(fd.get("track_id") ?? "");
  const trackId = /^[0-9a-f-]{36}$/i.test(trackRaw) ? trackRaw : null;
  if (!trackId && !isLibrary && !id) {
    return { error: "Escolha a trilha do conteúdo.", fieldErrors: { track_id: "Escolha a trilha ou marque como material da Biblioteca." } };
  }
  const rules = isLibrary ? parseAudience(fd) : [];

  // Limpa campos que não pertencem ao formato escolhido.
  const d = parsed.data;
  const row = {
    ...d,
    body: d.kind === "texto" ? d.body : null,
    url: d.kind === "link" || d.kind === "video" ? d.url : null,
    external_platform: d.kind === "link" || d.kind === "video" ? d.external_platform : null,
    access_note: d.kind === "link" || d.kind === "video" ? d.access_note : null,
    storage_path: d.kind === "arquivo" ? d.storage_path : null,
    file_name: d.kind === "arquivo" ? d.file_name : null,
    file_size: d.kind === "arquivo" ? d.file_size : null,
    mime_type: d.kind === "arquivo" ? d.mime_type : null,
    is_library: isLibrary,
    track_id: trackId,
  };
  // Conteúdo existente: a trilha só muda pelo "Mover de trilha" (ação própria).
  const update: Partial<typeof row> = { ...row };
  delete update.track_id;

  const supabase = await createClient();
  let contentId = id;
  let previousFile: string | null = null;
  if (id) {
    const { data: before } = await supabase.from("contents").select("storage_path, track_id").eq("id", id).maybeSingle();
    previousFile = before?.storage_path ?? null;
    if (!before?.track_id && !isLibrary) {
      return {
        error: "Este conteúdo não tem trilha, então precisa continuar na Biblioteca. Para colocá-lo numa trilha, use Mover de trilha.",
        fieldErrors: { is_library: "Sem trilha, o conteúdo fica na Biblioteca." },
      };
    }
    const { error } = await supabase.from("contents").update(update).eq("id", id);
    if (error) return { error: friendlyError(error) };
  } else {
    const { data, error } = await supabase.from("contents").insert(row).select("id").single();
    if (error) return { error: friendlyError(error) };
    contentId = data.id;
  }

  // Público da biblioteca: substitui as regras.
  const { error: delErr } = await supabase.from("audience_rules").delete().eq("content_id", contentId);
  if (delErr) return { error: friendlyError(delErr) };
  if (rules.length) {
    const { error } = await supabase.from("audience_rules").insert(rules.map((r) => ({ ...r, content_id: contentId })));
    if (error) return { error: friendlyError(error) };
  }

  if (previousFile && previousFile !== row.storage_path) {
    await supabase.storage.from("conteudos").remove([previousFile]);
  }

  await revalidatePath("/conteudos");
  await revalidatePath(`/conteudos/${contentId}`);
  if (trackId) await revalidatePath(`/trilhas/${trackId}`);
  await revalidatePath("/materiais");
  if (!id) return { redirectTo: `/conteudos/${contentId}?aviso=criado` };
  const msg = { publicado: "Conteúdo publicado. Já aparece para o público dele.", rascunho: "Salvo como rascunho. Ainda não aparece para os colaboradores.", arquivado: "Conteúdo arquivado." };
  return { ok: msg[d.status] };
}

export async function deleteContent(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.conteudosExcluir);
  if (denied) return denied;
  const id = String(fd.get("id") ?? "");
  const supabase = await createClient();
  const { data: c } = await supabase.from("contents").select("storage_path").eq("id", id).maybeSingle();
  const { data, error } = await supabase.from("contents").delete().eq("id", id).select("id");
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "Este conteúdo está em uma trilha ou já tem progresso registrado. Arquive em vez de excluir."
          : friendlyError(error),
    };
  }
  if (!data?.length) return { error: "Conteúdo não encontrado." };
  if (c?.storage_path) await supabase.storage.from("conteudos").remove([c.storage_path]);
  await revalidatePath("/conteudos");
  await revalidatePath("/trilhas", "layout");
  // Excluído na própria página do conteúdo: volta para a lista.
  if (fd.get("voltar") === "1") return { redirectTo: "/conteudos" };
  return { ok: "Conteúdo excluído." };
}

/**
 * Move o conteúdo para outra trilha (ou para a Biblioteca). Ele sai dos
 * módulos da trilha antiga; nunca fica em duas trilhas ao mesmo tempo.
 */
export async function moveContent(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.conteudosEditar);
  if (denied) return denied;
  const id = String(fd.get("id") ?? "");
  const target = String(fd.get("track_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Conteúdo inválido." };
  const toLibrary = target === "biblioteca";
  if (!toLibrary && !/^[0-9a-f-]{36}$/i.test(target)) {
    return { error: "Escolha a trilha de destino.", fieldErrors: { track_id: "Escolha a trilha de destino." } };
  }
  const supabase = await createClient();
  const { data: before } = await supabase.from("contents").select("track_id").eq("id", id).maybeSingle();
  const { data: removed, error } = await supabase.rpc("move_content_to_track", { p_content: id, p_track: toLibrary ? null : target });
  if (error) return { error: friendlyError(error) };

  await revalidatePath("/conteudos");
  await revalidatePath(`/conteudos/${id}`);
  if (before?.track_id) await revalidatePath(`/trilhas/${before.track_id}`);
  if (!toLibrary) await revalidatePath(`/trilhas/${target}`);
  await revalidatePath("/materiais");
  await revalidatePath("/minhas-trilhas", "layout");
  const n = Number(removed ?? 0);
  const where = toLibrary ? "para a Biblioteca" : "para a nova trilha";
  return {
    ok: n
      ? `Conteúdo movido ${where}. Ele saiu de ${n} ${n === 1 ? "módulo" : "módulos"} da trilha anterior; inclua-o num módulo da nova trilha para os colaboradores verem.`
      : `Conteúdo movido ${where}.${toLibrary ? "" : " Inclua-o num módulo da trilha para os colaboradores verem."}`,
  };
}
