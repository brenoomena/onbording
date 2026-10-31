"use server";

import { revalidatePath } from "next/cache";
import { denyUnless, denyUnlessAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { P } from "@/lib/permissions";
import { fromZod, formObject, type ActionState } from "@/lib/action-state";
import { areaSchema, levelSchema, positionSchema } from "@/lib/validation";

const TABLES = { areas: "areas", cargos: "positions", niveis: "levels" } as const;
type Kind = keyof typeof TABLES;

function kindOf(fd: FormData): Kind {
  const k = String(fd.get("kind") ?? "");
  if (!(k in TABLES)) throw new Error("Tipo inválido");
  return k as Kind;
}

function refresh(kind: Kind) {
  revalidatePath(`/estrutura/${kind}`);
  revalidatePath("/colaboradores");
}

// ------------------------------------------------------------------ áreas

export async function saveArea(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(fd.get("id") ? P.estruturaEditar : P.estruturaCriar);
  if (denied) return denied;
  const parsed = areaSchema.safeParse(formObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const id = String(fd.get("id") ?? "");
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("areas").update(parsed.data).eq("id", id)
    : await supabase.from("areas").insert(parsed.data);
  if (error) return { error: friendlyError(error) };
  refresh("areas");
  return { ok: id ? "Área atualizada." : `Área "${parsed.data.name}" criada.` };
}

// ------------------------------------------------------------------ níveis

export async function saveLevel(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(fd.get("id") ? P.estruturaEditar : P.estruturaCriar);
  if (denied) return denied;
  const parsed = levelSchema.safeParse(formObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const id = String(fd.get("id") ?? "");
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("levels").update(parsed.data).eq("id", id);
    if (error) return { error: friendlyError(error) };
  } else {
    const { data: last } = await supabase.from("levels").select("rank").order("rank", { ascending: false }).limit(1).maybeSingle();
    const { error } = await supabase.from("levels").insert({ ...parsed.data, rank: (last?.rank ?? 0) + 1 });
    if (error) return { error: friendlyError(error) };
  }
  refresh("niveis");
  return { ok: id ? "Nível atualizado." : `Nível "${parsed.data.name}" criado no topo da hierarquia.` };
}

export async function moveLevel(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.estruturaEditar);
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_level", {
    p_level_id: String(fd.get("id")),
    p_direction: Number(fd.get("direction")),
  });
  if (error) return { error: friendlyError(error) };
  refresh("niveis");
  return {};
}

// ------------------------------------------------------------------ cargos

export async function savePosition(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(fd.get("id") ? P.estruturaEditar : P.estruturaCriar);
  if (denied) return denied;
  const parsed = positionSchema.safeParse(formObject(fd));
  if (!parsed.success) return fromZod(parsed.error);
  const id = String(fd.get("id") ?? "");
  const levelIds = fd.getAll("level_ids").map(String).filter(Boolean);
  const supabase = await createClient();

  let positionId = id;
  if (id) {
    const { data: current } = await supabase.from("positions").select("area_id").eq("id", id).single();
    if (current && current.area_id !== parsed.data.area_id) {
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("position_id", id);
      if ((count ?? 0) > 0) {
        return { error: "Este cargo tem colaboradores vinculados e não pode mudar de área. Crie um novo cargo na outra área." };
      }
    }
    const { error } = await supabase.from("positions").update(parsed.data).eq("id", id);
    if (error) return { error: friendlyError(error) };
  } else {
    const { data, error } = await supabase.from("positions").insert(parsed.data).select("id").single();
    if (error) return { error: friendlyError(error) };
    positionId = data.id;
  }

  // Sincroniza os níveis permitidos para o cargo.
  const { data: links } = await supabase.from("position_levels").select("level_id").eq("position_id", positionId);
  const current = new Set((links ?? []).map((l) => l.level_id as string));
  const wanted = new Set(levelIds);
  const toRemove = [...current].filter((l) => !wanted.has(l));
  const toAdd = [...wanted].filter((l) => !current.has(l));

  if (toRemove.length) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("position_id", positionId)
      .in("level_id", toRemove);
    if ((count ?? 0) > 0) {
      return { error: `Há ${count} colaborador(es) neste cargo com um dos níveis que você desmarcou. Mude o nível deles antes.` };
    }
    const { error } = await supabase.from("position_levels").delete().eq("position_id", positionId).in("level_id", toRemove);
    if (error) return { error: friendlyError(error) };
  }
  if (toAdd.length) {
    const { error } = await supabase.from("position_levels").insert(toAdd.map((level_id) => ({ position_id: positionId, level_id })));
    if (error) return { error: friendlyError(error) };
  }

  refresh("cargos");
  return { ok: id ? "Cargo atualizado." : `Cargo "${parsed.data.name}" criado.` };
}

// ------------------------------------------------------------------ comuns

export async function toggleActive(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.estruturaEditar);
  if (denied) return denied;
  const kind = kindOf(fd);
  const active = fd.get("active") === "true";
  const supabase = await createClient();
  const { error } = await supabase.from(TABLES[kind]).update({ active }).eq("id", String(fd.get("id")));
  if (error) return { error: friendlyError(error) };
  refresh(kind);
  return {};
}

export async function removeItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnless(P.estruturaExcluir);
  if (denied) return denied;
  const kind = kindOf(fd);
  const supabase = await createClient();
  const { data, error } = await supabase.from(TABLES[kind]).delete().eq("id", String(fd.get("id"))).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Registro não encontrado." };
  refresh(kind);
  return {};
}
