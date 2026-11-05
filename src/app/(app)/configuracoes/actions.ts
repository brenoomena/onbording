"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { denyUnlessAdmin } from "@/lib/auth";
import { BRANDING_TAG } from "@/lib/branding";
import { friendlyError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_THEME, TOKEN_KEYS, sanitizeTheme, type ThemeConfig } from "@/lib/theme-tokens";
import type { ActionState } from "@/lib/action-state";
import { diffLogin, sanitizeLogin } from "@/lib/login-theme";
import { diffCertificate, sanitizeCertificate } from "@/lib/certificate";
import { LOGO_SLOTS, defaultSize, fromWidth, sanitizeSizes, type LogoSlot } from "@/lib/logo-sizes";

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

const COLUMN: Record<LogoSlot, "logo_path" | "logo_dark_path" | "symbol_path" | "symbol_dark_path"> = {
  logo: "logo_path",
  logo_dark: "logo_dark_path",
  symbol: "symbol_path",
  symbol_dark: "symbol_dark_path",
};

function isSlot(v: unknown): v is LogoSlot {
  return typeof v === "string" && (LOGO_SLOTS as readonly string[]).includes(v);
}

/**
 * Grava (ou remove) a imagem de uma variante e apaga o arquivo anterior.
 * Ao enviar, já define o tamanho padrão a partir da proporção da imagem.
 */
export async function setLogo(slot: LogoSlot, path: string | null, ratio?: number): Promise<ActionState> {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  if (!isSlot(slot)) return { error: "Variante de logomarca inválida." };
  if (path !== null && !LOGO_PATH.test(path)) return { error: "Arquivo de logomarca inválido." };
  const column = COLUMN[slot];
  const supabase = await createClient();
  const { data: before } = await supabase.from("app_settings").select("logo_path, logo_dark_path, symbol_path, symbol_dark_path, logo_sizes").eq("id", 1).maybeSingle();
  const sizes = { ...sanitizeSizes(before?.logo_sizes) };
  if (path && ratio && ratio > 0 && Number.isFinite(ratio)) sizes[slot] = defaultSize(slot, ratio);
  else if (!path) delete sizes[slot];
  const { data, error } = await supabase.from("app_settings").update({ [column]: path, logo_sizes: sizes }).eq("id", 1).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Somente administradores podem alterar a logomarca." };
  const old = before?.[column];
  if (old && old !== path) await supabase.storage.from("branding").remove([old]);
  refreshBranding();
  return { ok: path ? "Imagem atualizada." : "Imagem removida." };
}

/** Ajusta o tamanho de exibição mantendo a proporção e os limites mínimo e máximo. */
export async function setLogoSize(slot: LogoSlot, width: number, ratio: number): Promise<ActionState> {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  if (!isSlot(slot)) return { error: "Variante de logomarca inválida." };
  if (!(ratio > 0) || !Number.isFinite(ratio) || !Number.isFinite(width)) return { error: "Tamanho inválido." };
  const size = fromWidth(slot, ratio, width);
  const supabase = await createClient();
  const { data: before } = await supabase.from("app_settings").select("logo_sizes").eq("id", 1).maybeSingle();
  const sizes = { ...sanitizeSizes(before?.logo_sizes), [slot]: size };
  const { data, error } = await supabase.from("app_settings").update({ logo_sizes: sizes }).eq("id", 1).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Somente administradores podem alterar a logomarca." };
  refreshBranding();
  return { ok: `Tamanho salvo: ${size.w} × ${size.h} px.` };
}

const FAVICON_PATH = /^logo\/[0-9a-f-]{36}\.png$/;

/** Grava (ou remove) o favicon e apaga o arquivo anterior. Somente Administrador. */
export async function setFavicon(path: string | null): Promise<ActionState> {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  if (path !== null && !FAVICON_PATH.test(path)) return { error: "Arquivo de favicon inválido." };
  const supabase = await createClient();
  const { data: before } = await supabase.from("app_settings").select("favicon_path").eq("id", 1).maybeSingle();
  const { data, error } = await supabase.from("app_settings").update({ favicon_path: path }).eq("id", 1).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Somente administradores podem alterar o favicon." };
  const old = before?.favicon_path;
  if (old && old !== path) await supabase.storage.from("branding").remove([old]);
  refreshBranding();
  return { ok: path ? "Favicon atualizado. Pode levar alguns instantes para aparecer na aba do navegador." : "Favicon removido; voltou o ícone padrão." };
}

/** Salva a aparência da página de login (só o que difere do padrão). Somente Administrador. */
export async function saveLoginTheme(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(fd.get("login") ?? "{}"));
  } catch {
    return { error: "Não foi possível ler a configuração enviada." };
  }
  const clean = sanitizeLogin(parsed);
  if (clean.title !== undefined && clean.title.length < 2) return { error: "Escreva o título do cartão de entrada." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_settings").update({ login_theme: diffLogin(clean) }).eq("id", 1).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Somente administradores podem alterar a página de login." };
  refreshBranding();
  return { ok: "Página de login salva. Ela já aparece assim para todos." };
}

/** Salva o modelo do certificado; apaga a imagem de assinatura trocada. Somente Administrador. */
export async function saveCertificateTheme(_: ActionState, fd: FormData): Promise<ActionState> {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(fd.get("certificate") ?? "{}"));
  } catch {
    return { error: "Não foi possível ler o modelo enviado." };
  }
  const clean = sanitizeCertificate(parsed);
  if (clean.title !== undefined && clean.title.length < 2) return { error: "Escreva o título do certificado." };
  if (clean.body !== undefined && !clean.body.includes("{trilha}")) {
    return { error: "O texto precisa ter o marcador {trilha}, que é trocado pelo nome da trilha." };
  }
  const supabase = await createClient();
  const { data: before } = await supabase.from("app_settings").select("certificate_theme").eq("id", 1).maybeSingle();
  const { data, error } = await supabase.from("app_settings").update({ certificate_theme: diffCertificate(clean) }).eq("id", 1).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Somente administradores podem alterar o certificado." };
  const prev = sanitizeCertificate(before?.certificate_theme);
  const removed = [
    prev.signaturePath && prev.signaturePath !== (clean.signaturePath ?? null) ? prev.signaturePath : null,
    prev.logoPath && prev.logoPath !== (clean.logoPath ?? null) ? prev.logoPath : null,
  ].filter((x): x is string => !!x);
  if (removed.length) await supabase.storage.from("branding").remove(removed);
  refreshBranding();
  return { ok: "Modelo do certificado salvo. Vale para todos os certificados, inclusive os já emitidos." };
}
