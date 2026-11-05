"use server";

import { revalidatePath } from "@/lib/revalidate";

import { denyUnless, denyUnlessAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { P } from "@/lib/permissions";
import { fromZod, formObject, type ActionState } from "@/lib/action-state";
import { contentSchema, parseAudience } from "@/lib/validation";
import { parseQuiz } from "@/lib/quiz";

export async function saveContent(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(fd.get("id") ? P.conteudosEditar : P.conteudosCriar);
  if (denied) return denied;
  const raw = formObject(fd);
  const parsed = contentSchema.safeParse(raw);
  if (!parsed.success) return fromZod(parsed.error);
  const id = String(fd.get("id") ?? "");
  const isQuiz = parsed.data.kind === "avaliacao";
  // Avaliação: perguntas vêm do editor; só existe dentro de uma trilha.
  const quiz = isQuiz ? parseQuiz(fd.get("quiz")) : null;
  if (quiz && !quiz.ok) return { error: quiz.error, fieldErrors: { quiz: quiz.error } };
  if (quiz?.ok && parsed.data.status === "publicado" && quiz.questions.length === 0) {
    return { error: "Cadastre ao menos uma pergunta antes de publicar a avaliação.", fieldErrors: { quiz: "Cadastre ao menos uma pergunta." } };
  }
  const isLibrary = !isQuiz && fd.get("is_library") === "on";
  // Trilha a que o conteúdo pertence; sem trilha, só como material da Biblioteca.
  const trackRaw = String(fd.get("track_id") ?? "");
  const trackId = /^[0-9a-f-]{36}$/i.test(trackRaw) ? trackRaw : null;
  if (isQuiz && !trackId && !id) {
    return { error: "A avaliação precisa estar numa trilha.", fieldErrors: { track_id: "Escolha a trilha da avaliação." } };
  }
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
    passing_score: isQuiz ? d.passing_score : 70,
    max_attempts: isQuiz ? d.max_attempts : null,
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

  if (quiz?.ok) {
    const { error } = await supabase.rpc("save_quiz_questions", { p_content: contentId, p_questions: quiz.questions });
    if (error) return { error: friendlyError(error, "Não foi possível salvar as perguntas.") };
  } else if (id) {
    // Deixou de ser avaliação: as perguntas não fazem mais sentido.
    await supabase.from("quiz_questions").delete().eq("content_id", contentId);
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
  if (!id && fd.get("em_trilha") === "1" && trackId) {
    // Criado na aba "Novo conteúdo" da trilha: já entra no módulo escolhido.
    const moduleId = String(fd.get("module_id") ?? "");
    const published = d.status === "publicado" ? "publicado" : "criado como rascunho";
    if (!/^[0-9a-f-]{36}$/i.test(moduleId)) {
      return { ok: `Conteúdo "${d.title}" ${published}. Ele ainda não está em nenhum módulo.` };
    }
    if (await denyUnless(P.trilhasEditar)) {
      return { ok: `Conteúdo "${d.title}" ${published}. Para incluí-lo num módulo é preciso a permissão de editar trilhas.` };
    }
    const { data: last } = await supabase.from("module_items").select("position").eq("module_id", moduleId).order("position", { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from("module_items").insert({
      module_id: moduleId,
      content_id: contentId,
      position: (last?.position ?? 0) + 1,
      is_required: fd.get("module_required") === "on",
    });
    if (error) return { ok: `Conteúdo "${d.title}" ${published}, mas não foi possível incluí-lo no módulo: ${friendlyError(error)}` };
    await revalidatePath("/minhas-trilhas", "layout");
    return { ok: `Conteúdo "${d.title}" ${published} e incluído no módulo.` };
  }
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
