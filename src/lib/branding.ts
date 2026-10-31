import { createClient as createPlainClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { publicEnv } from "@/lib/env";
import { DEFAULT_THEME, isDark, sanitizeTheme, type ThemeConfig } from "@/lib/theme-tokens";

export interface Branding {
  theme: ThemeConfig;
  logoPath: string | null;
  logoDarkPath: string | null;
}

export const BRANDING_TAG = "branding";
const EMPTY: Branding = { theme: {}, logoPath: null, logoDarkPath: null };

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
      const d = data as { theme?: unknown; logo_path?: string | null; logo_dark_path?: string | null };
      return { theme: sanitizeTheme(d.theme), logoPath: d.logo_path ?? null, logoDarkPath: d.logo_dark_path ?? null };
    } catch {
      return EMPTY;
    }
  },
  ["branding-v1"],
  { tags: [BRANDING_TAG], revalidate: 600 },
);

export function brandingUrl(path: string | null | undefined): string | null {
  if (!path || !/^logo\/[0-9a-f-]{36}\.(png|webp|jpg)$/.test(path)) return null;
  return `${publicEnv.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/branding/${path}`;
}

/**
 * Qual arquivo de logo usar sobre um fundo: o de fundo escuro quando o fundo
 * é escuro e ele existe; senão o principal.
 */
export function logoFor(b: Branding, background: string): string | null {
  const dark = isDark(background);
  return brandingUrl(dark && b.logoDarkPath ? b.logoDarkPath : b.logoPath ?? b.logoDarkPath);
}

export { DEFAULT_THEME };
