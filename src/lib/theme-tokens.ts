/**
 * Design tokens da identidade visual. Fonte única das cores padrão: o layout
 * raiz gera as variáveis CSS a partir daqui, somando as personalizações que o
 * Administrador salvou em Configurações (tabela app_settings).
 */

export type Mode = "light" | "dark";

export const TOKEN_KEYS = [
  "sidebar-bg",
  "sidebar-text",
  "sidebar-muted",
  "sidebar-active-bg",
  "sidebar-active-text",
  "brand",
  "on-brand",
  "accent",
  "accent-soft",
  "icon",
  "heading",
  "ink",
  "muted",
  "bg",
  "surface",
  "sunken",
  "line",
] as const;
export type TokenKey = (typeof TOKEN_KEYS)[number];
export type ThemeColors = Partial<Record<TokenKey, string>>;
export type ThemeConfig = Partial<Record<Mode, ThemeColors>>;

export const TOKEN_GROUPS: { title: string; hint: string; tokens: { key: TokenKey; label: string; hint?: string }[] }[] = [
  {
    title: "Menu lateral",
    hint: "Fundo, textos e item selecionado do menu de navegação.",
    tokens: [
      { key: "sidebar-bg", label: "Fundo do menu" },
      { key: "sidebar-text", label: "Texto do menu" },
      { key: "sidebar-muted", label: "Títulos de seção do menu" },
      { key: "sidebar-active-bg", label: "Fundo do item ativo" },
      { key: "sidebar-active-text", label: "Texto do item ativo" },
    ],
  },
  {
    title: "Cores principais",
    hint: "Botões, links, ícones e destaques.",
    tokens: [
      { key: "brand", label: "Primária (botões)" },
      { key: "on-brand", label: "Texto sobre a primária" },
      { key: "accent", label: "Secundária (links e destaques)" },
      { key: "accent-soft", label: "Destaque suave (fundos de ícones e seleção)" },
      { key: "icon", label: "Ícones" },
    ],
  },
  {
    title: "Textos",
    hint: "Títulos, texto corrido e textos de apoio.",
    tokens: [
      { key: "heading", label: "Títulos" },
      { key: "ink", label: "Texto" },
      { key: "muted", label: "Subtítulos e apoio" },
    ],
  },
  {
    title: "Fundos e bordas",
    hint: "Página, cartões, áreas internas e linhas.",
    tokens: [
      { key: "bg", label: "Fundo da página" },
      { key: "surface", label: "Cartões e painéis" },
      { key: "sunken", label: "Áreas internas e cabeçalhos de tabela" },
      { key: "line", label: "Bordas" },
    ],
  },
];

/** Paleta Implantta: azul #14AFFC, cinza escuro #333333, menu azul-marinho. */
export const DEFAULT_THEME: Record<Mode, Record<TokenKey, string>> = {
  light: {
    "sidebar-bg": "#0f1b2d",
    "sidebar-text": "#d5deea",
    "sidebar-muted": "#7d8ea6",
    "sidebar-active-bg": "#1c2c44",
    "sidebar-active-text": "#ffffff",
    brand: "#14affc",
    "on-brand": "#0d2231",
    accent: "#0b86c8",
    "accent-soft": "#e2f4fe",
    icon: "#0b86c8",
    heading: "#16202c",
    ink: "#333333",
    muted: "#69717b",
    bg: "#f3f6fa",
    surface: "#ffffff",
    sunken: "#eef1f5",
    line: "#dfe6ee",
  },
  dark: {
    "sidebar-bg": "#0b1320",
    "sidebar-text": "#cdd6e2",
    "sidebar-muted": "#6f8099",
    "sidebar-active-bg": "#18263a",
    "sidebar-active-text": "#ffffff",
    brand: "#14affc",
    "on-brand": "#0d2231",
    accent: "#5cc8ff",
    "accent-soft": "#1d3a4c",
    icon: "#5cc8ff",
    heading: "#f3f6fa",
    ink: "#e6ebf1",
    muted: "#a6afb9",
    bg: "#151a21",
    surface: "#1d232c",
    sunken: "#252c36",
    line: "#323a46",
  },
};

/** Cores de estado (não personalizáveis, para manter o significado). */
const STATUS: Record<Mode, Record<string, string>> = {
  light: { ok: "#15803d", "ok-soft": "#e7f5ec", warn: "#a16207", "warn-soft": "#fef3c7", danger: "#b91c1c", "danger-soft": "#fee2e2" },
  dark: { ok: "#4ade80", "ok-soft": "#173322", warn: "#facc15", "warn-soft": "#423410", danger: "#f87171", "danger-soft": "#451a1a" },
};

const HEX = /^#[0-9a-f]{6}$/i;

export function isHex(v: unknown): v is string {
  return typeof v === "string" && HEX.test(v);
}

/** Aceita só tokens conhecidos com cor #RRGGBB (o resto é descartado). */
export function sanitizeTheme(input: unknown): ThemeConfig {
  const out: ThemeConfig = {};
  if (!input || typeof input !== "object") return out;
  for (const mode of ["light", "dark"] as const) {
    const src = (input as Record<string, unknown>)[mode];
    if (!src || typeof src !== "object") continue;
    const colors: ThemeColors = {};
    for (const k of TOKEN_KEYS) {
      const v = (src as Record<string, unknown>)[k];
      if (isHex(v)) colors[k] = v.toLowerCase();
    }
    if (Object.keys(colors).length) out[mode] = colors;
  }
  return out;
}

export function resolveTheme(custom: ThemeConfig): Record<Mode, Record<TokenKey, string>> {
  return {
    light: { ...DEFAULT_THEME.light, ...(custom.light ?? {}) },
    dark: { ...DEFAULT_THEME.dark, ...(custom.dark ?? {}) },
  };
}

function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Luminância relativa (0 escuro … 1 claro). */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function isDark(hex: string): boolean {
  return luminance(hex) < 0.22;
}

function vars(colors: Record<string, string>): string {
  return Object.entries(colors)
    .filter(([, v]) => isHex(v))
    .map(([k, v]) => `--${k}:${rgb(v)};`)
    .join("");
}

/**
 * CSS com as variáveis dos dois modos. Os valores já passaram por
 * isHex, então não há como injetar outro CSS por aqui.
 */
export function themeCss(custom: ThemeConfig): string {
  const t = resolveTheme(sanitizeTheme(custom));
  const light = vars({ ...t.light, ...STATUS.light });
  const dark = vars({ ...t.dark, ...STATUS.dark });
  return (
    `:root{${light}color-scheme:light;}` +
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark}color-scheme:dark;}}` +
    `:root[data-theme="dark"]{${dark}color-scheme:dark;}`
  );
}

/** Variáveis de um modo como estilo inline (prévia da tela de Configurações). */
export function themeStyle(colors: Record<TokenKey, string>, mode: Mode): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...colors, ...STATUS[mode] })) if (isHex(v)) out[`--${k}`] = rgb(v);
  return out;
}
