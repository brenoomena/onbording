"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { P } from "@/lib/permissions";
import { fromZod, formObject, type ActionState } from "@/lib/action-state";
import { contentSchema, parseAudience } from "@/lib/validation";

export async function saveContent(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePermission(P.conteudosGerenciar);
  const raw = formObject(fd);
  const parsed = contentSchema.safeParse(raw);
  if (!parsed.success) return fromZod(parsed.error);
  const id = String(fd.get("id") ?? "");
  const isLibrary = fd.get("is_library") === "on";
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
  };

  const supabase = await createClient();
  let contentId = id;
  let previousFile: string | null = null;
  if (id) {
    const { data: before } = await supabase.from("contents").select("storage_path").eq("id", id).maybeSingle();
    previousFile = before?.storage_path ?? null;
    const { error } = await supabase.from("contents").update(row).eq("id", id);
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

  revalidatePath("/conteudos");
  revalidatePath(`/conteudos/${contentId}`);
  revalidatePath("/materiais");
  if (!id) redirect(`/conteudos/${contentId}?aviso=criado`);
  const msg = { publicado: "Conteúdo publicado. Já aparece para o público dele.", rascunho: "Salvo como rascunho. Ainda não aparece para os colaboradores.", arquivado: "Conteúdo arquivado." };
  return { ok: msg[d.status] };
}

export async function deleteContent(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePermission(P.conteudosGerenciar);
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
  revalidatePath("/conteudos");
  redirect("/conteudos");
}
