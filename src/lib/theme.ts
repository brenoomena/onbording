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
