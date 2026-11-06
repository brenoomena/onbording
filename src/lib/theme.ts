/** Preferência de tema guardada em cookie neste navegador. */
export const THEME_COOKIE = "tema";
export const THEMES = ["sistema", "claro", "escuro"] as const;
export type Theme = (typeof THEMES)[number];

export function parseTheme(v: string | undefined | null): Theme {
  return THEMES.includes(v as Theme) ? (v as Theme) : "sistema";
}

/** Valor do atributo data-theme no <html> (sem atributo = segue o sistema). */
export function themeAttr(t: Theme): "light" | "dark" | undefined {
  return t === "claro" ? "light" : t === "escuro" ? "dark" : undefined;
}

/** Cookie com a preferência de menu recolhido ("compacto") ou aberto. */
export const MENU_COOKIE = "menu";

/** Cookie com os grupos do menu recolhidos (nomes separados por "|"). */
export const GROUPS_COOKIE = "menu_grupos";
/** Recolhidos até a pessoa abrir: dão mais espaço ao menu. */
export const DEFAULT_COLLAPSED = ["Estrutura", "Administração"];

export function parseCollapsed(v: string | undefined | null): string[] {
  if (v === undefined || v === null) return DEFAULT_COLLAPSED;
  try {
    return decodeURIComponent(v)
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return DEFAULT_COLLAPSED;
  }
}

export function serializeCollapsed(labels: string[]): string {
  return encodeURIComponent(labels.join("|"));
}
