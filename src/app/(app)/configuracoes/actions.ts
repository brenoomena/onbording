"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { denyUnlessAdmin } from "@/lib/auth";
import { BRANDING_TAG } from "@/lib/branding";
import { friendlyError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_THEME, TOKEN_KEYS, sanitizeTheme, type ThemeConfig } from "@/lib/theme-tokens";
import type { ActionState } from "@/lib/action-state";

const LOGO_PATH = /^logo\/[0-9a-f-]{36}\.(png|webp|jpg)$/;

function refreshBranding() {
  revalidateTag(BRANDING_TAG);
  revalidatePath("/", "layout");
}

/** Salva as cores (só o que difere do padrão). Somente Administrador. */
export async function saveTheme(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(fd.get("theme") ?? "{}"));
  } catch {
    return { error: "Não foi possível ler as cores enviadas." };
  }
  const clean = sanitizeTheme(parsed);
  const diff: ThemeConfig = {};
  for (const mode of ["light", "dark"] as const) {
    const colors = clean[mode] ?? {};
    for (const k of TOKEN_KEYS) {
      if (colors[k] && colors[k] !== DEFAULT_THEME[mode][k]) diff[mode] = { ...(diff[mode] ?? {}), [k]: colors[k] };
    }
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_settings").update({ theme: diff }).eq("id", 1).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Somente administradores podem alterar a identidade visual." };
  refreshBranding();
  return { ok: "Cores salvas e aplicadas a todo o sistema." };
}

/** Grava (ou remove) a logomarca de uma das variantes e apaga o arquivo anterior. */
export async function setLogo(variant: "light" | "dark", path: string | null): Promise<ActionState> {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  if (path !== null && !LOGO_PATH.test(path)) return { error: "Arquivo de logomarca inválido." };
  const column = variant === "dark" ? "logo_dark_path" : "logo_path";
  const supabase = await createClient();
  const { data: before } = await supabase.from("app_settings").select("logo_path, logo_dark_path").eq("id", 1).maybeSingle();
  const { data, error } = await supabase.from("app_settings").update({ [column]: path }).eq("id", 1).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Somente administradores podem alterar a logomarca." };
  const old = before?.[column as "logo_path" | "logo_dark_path"];
  if (old && old !== path) await supabase.storage.from("branding").remove([old]);
  refreshBranding();
  return { ok: path ? "Logomarca atualizada." : "Logomarca removida." };
}
