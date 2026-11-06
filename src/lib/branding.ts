import { createClient as createPlainClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { publicEnv } from "@/lib/env";
import { defaultSize, sanitizeSizes, type LogoSizes, type LogoSlot, type Size } from "@/lib/logo-sizes";
import { sanitizeTags, type TagTheme } from "@/lib/tag-catalog";
import { resolveCertificate, sanitizeCertificate, type CertificateTheme } from "@/lib/certificate";
import { resolveLogin, sanitizeLogin, type LoginTheme } from "@/lib/login-theme";
import { DEFAULT_THEME, isDark, sanitizeTheme, type ThemeConfig } from "@/lib/theme-tokens";

export interface Branding {
  theme: ThemeConfig;
  logoPath: string | null;
  logoDarkPath: string | null;
  symbolPath: string | null;
  symbolDarkPath: string | null;
  faviconPath: string | null;
  sizes: LogoSizes;
  login: LoginTheme;
  certificate: CertificateTheme;
  tags: TagTheme;
}

/** Imagem pronta para exibir: endereço e tamanho em pixels (null = tamanho automático). */
export interface BrandImage {
  src: string;
  size: Size | null;
}

export const BRANDING_TAG = "branding";
const EMPTY: Branding = { theme: {}, logoPath: null, logoDarkPath: null, symbolPath: null, symbolDarkPath: null, faviconPath: null, sizes: {}, login: resolveLogin({}), certificate: resolveCertificate({}), tags: {} };

/**
 * Identidade visual para desenhar as telas (inclusive login). Lida pela
 * função pública get_branding() e guardada em cache até o Administrador
 * salvar outra configuração (revalidateTag).
 */
export const getBranding = unstable_cache(
  async (): Promise<Branding> => {
    try {
      const sb = createPlainClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await sb.rpc("get_branding");
      if (error || !data) return EMPTY;
      const d = data as Record<string, unknown>;
      const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : null);
      return {
        theme: sanitizeTheme(d.theme),
        logoPath: str("logo_path"),
        logoDarkPath: str("logo_dark_path"),
        symbolPath: str("symbol_path"),
        symbolDarkPath: str("symbol_dark_path"),
        faviconPath: str("favicon_path"),
        sizes: sanitizeSizes(d.logo_sizes),
        login: resolveLogin(sanitizeLogin(d.login_theme)),
        certificate: resolveCertificate(sanitizeCertificate(d.certificate_theme)),
        tags: sanitizeTags(d.tag_theme),
      };
    } catch {
      return EMPTY;
    }
  },
  ["branding-v6"],
  { tags: [BRANDING_TAG], revalidate: 600 },
);

export function brandingUrl(path: string | null | undefined): string | null {
  if (!path || !/^logo\/[0-9a-f-]{36}\.(png|webp|jpg)$/.test(path)) return null;
  return `${publicEnv.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/branding/${path}`;
}

function pick(b: Branding, background: string, light: LogoSlot, dark: LogoSlot): BrandImage | null {
  const paths: Record<LogoSlot, string | null> = {
    logo: b.logoPath,
    logo_dark: b.logoDarkPath,
    symbol: b.symbolPath,
    symbol_dark: b.symbolDarkPath,
  };
  // Sobre fundo escuro usa a versão para fundo escuro, se existir; senão a principal.
  const slot = isDark(background) && paths[dark] ? dark : paths[light] ? light : paths[dark] ? dark : null;
  if (!slot) return null;
  const src = brandingUrl(paths[slot]);
  return src ? { src, size: b.sizes[slot] ?? null } : null;
}

/** Logo (menu aberto e login) para um fundo. */
export function logoFor(b: Branding, background: string): BrandImage | null {
  return pick(b, background, "logo", "logo_dark");
}

/** Símbolo (menu recolhido) para um fundo. */
export function symbolFor(b: Branding, background: string): BrandImage | null {
  return pick(b, background, "symbol", "symbol_dark");
}

/** Estilo de tamanho da imagem; sem tamanho salvo, usa o padrão da variante. */
export function sizeStyle(img: BrandImage, slotKind: "logo" | "symbol"): { width?: number; height?: number } {
  if (img.size) return { width: img.size.w, height: img.size.h };
  return slotKind === "logo" ? { width: 175 } : { height: defaultSize("symbol", 1).h };
}

export { DEFAULT_THEME };
