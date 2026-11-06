/**
 * Barra de rolagem do menu lateral (Configurações › Menu lateral), guardada em
 * app_settings.menu_theme. Todos os valores são validados antes de virar CSS.
 */

export const SB_WIDTHS = { fina: 6, media: 10, larga: 14 } as const;
export type SbWidth = keyof typeof SB_WIDTHS;
export const SB_WIDTH_LABEL: Record<SbWidth, string> = { fina: "Fina", media: "Média", larga: "Larga" };

export const SB_SHAPES = ["arredondada", "reta"] as const;
export type SbShape = (typeof SB_SHAPES)[number];
export const SB_SHAPE_LABEL: Record<SbShape, string> = { arredondada: "Arredondada", reta: "Reta" };

export const SB_VISIBILITY = ["sempre", "passar", "oculta"] as const;
export type SbVisibility = (typeof SB_VISIBILITY)[number];
export const SB_VISIBILITY_LABEL: Record<SbVisibility, string> = {
  sempre: "Sempre visível",
  passar: "Só ao passar o mouse",
  oculta: "Oculta (a rolagem continua)",
};

export interface SbColors {
  /** Barra (a parte que se arrasta). */
  thumb: string;
  /** Barra com o mouse por cima. */
  hover: string;
  /** Trilho; "" = transparente (mostra o fundo do menu). */
  track: string;
}

export interface Scrollbar {
  width: SbWidth;
  shape: SbShape;
  visibility: SbVisibility;
  light: SbColors;
  dark: SbColors;
}

export const DEFAULT_SCROLLBAR: Scrollbar = {
  width: "fina",
  shape: "arredondada",
  visibility: "sempre",
  light: { thumb: "#33496a", hover: "#4f6a92", track: "" },
  dark: { thumb: "#2a3a52", hover: "#44597a", track: "" },
};

const HEX = /^#[0-9a-f]{6}$/i;
const isHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v);

function pick<T extends string>(v: unknown, list: readonly T[], fallback: T): T {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback;
}

function colors(v: unknown, def: SbColors): SbColors {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    thumb: isHex(o.thumb) ? o.thumb.toLowerCase() : def.thumb,
    hover: isHex(o.hover) ? o.hover.toLowerCase() : def.hover,
    track: o.track === "" ? "" : isHex(o.track) ? o.track.toLowerCase() : def.track,
  };
}

/** Lê o que veio do banco ou do formulário; o que for inválido volta ao padrão. */
export function sanitizeScrollbar(v: unknown): Scrollbar {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    width: pick(o.width, Object.keys(SB_WIDTHS) as SbWidth[], DEFAULT_SCROLLBAR.width),
    shape: pick(o.shape, SB_SHAPES, DEFAULT_SCROLLBAR.shape),
    visibility: pick(o.visibility, SB_VISIBILITY, DEFAULT_SCROLLBAR.visibility),
    light: colors(o.light, DEFAULT_SCROLLBAR.light),
    dark: colors(o.dark, DEFAULT_SCROLLBAR.dark),
  };
}

export function isDefaultScrollbar(s: Scrollbar): boolean {
  return JSON.stringify(s) === JSON.stringify(DEFAULT_SCROLLBAR);
}

const vars = (c: SbColors) => `--sb-thumb:${c.thumb};--sb-hover:${c.hover};--sb-track:${c.track || "transparent"};`;

/**
 * CSS da barra. Chrome, Edge e Safari usam ::-webkit-scrollbar (largura em
 * pixels); o Firefox usa scrollbar-width/scrollbar-color.
 * `scope` define onde ficam as cores: no :root (sistema, claro/escuro) ou num
 * seletor fixo com um modo só (prévia em Configurações).
 */
export function scrollbarCss(s: Scrollbar, selector = ".sidebar-scroll", scope?: { mode: "light" | "dark" }): string {
  const w = SB_WIDTHS[s.width];
  const border = w >= 10 ? 2 : 1;
  const radius = s.shape === "arredondada" ? "999px" : "0";
  const sel = selector;
  let css = "";
  if (scope) css += `${sel}{${vars(s[scope.mode])}}`;
  else
    css +=
      `:root{${vars(s.light)}}` +
      `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${vars(s.dark)}}}` +
      `:root[data-theme="dark"]{${vars(s.dark)}}`;

  if (s.visibility === "oculta") {
    return css + `${sel}{scrollbar-width:none}${sel}::-webkit-scrollbar{display:none;width:0;height:0}`;
  }
  css +=
    `${sel}::-webkit-scrollbar{width:${w}px;height:${w}px}` +
    `${sel}::-webkit-scrollbar-track{background:var(--sb-track)}` +
    `${sel}::-webkit-scrollbar-corner{background:transparent}` +
    `${sel}::-webkit-scrollbar-thumb{background-color:var(--sb-thumb);border-radius:${radius};border:${border}px solid transparent;background-clip:padding-box}` +
    `${sel}::-webkit-scrollbar-thumb:hover{background-color:var(--sb-hover)}` +
    `@supports not selector(::-webkit-scrollbar){${sel}{scrollbar-width:${w <= 6 ? "thin" : "auto"};scrollbar-color:var(--sb-thumb) var(--sb-track)}}`;
  if (s.visibility === "passar") {
    css +=
      `${sel}:not(:hover)::-webkit-scrollbar-thumb{background-color:transparent}` +
      `${sel}:not(:hover)::-webkit-scrollbar-track{background:transparent}` +
      `@supports not selector(::-webkit-scrollbar){${sel}:not(:hover){scrollbar-color:transparent transparent}}`;
  }
  return css;
}
