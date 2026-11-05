/**
 * Aparência da página de login (e das telas de acesso). Puro: usado no
 * servidor (validação) e no navegador (editor e prévia).
 */

export type LoginEffect = "linhas" | "fluxo" | "ondas" | "constelacao" | "bokeh" | "aurora" | "nenhum";
export type LoginArea = "toda" | "esquerda" | "direita" | "superior" | "inferior" | "bordas" | "centro";
export type LoginFont =
  | "padrao"
  | "poppins"
  | "montserrat"
  | "jakarta"
  | "dmsans"
  | "nunito"
  | "raleway"
  | "roboto"
  | "lato"
  | "spacegrotesk"
  | "playfair"
  | "merriweather";
export type LoginTextKey = "headline" | "tagline" | "title" | "subtitle";
export type LoginCard = "vidro" | "claro" | "escuro";

export interface LoginTheme {
  /** Degradê do fundo: cor inicial, intermediária e final, e o ângulo (graus). */
  from: string;
  via: string;
  to: string;
  angle: number;
  effect: LoginEffect;
  effectColor: string;
  /** 1 a 10. */
  speed: number;
  /** 1 a 10: quantidade e brilho. */
  intensity: number;
  /** Parte da tela onde o efeito aparece. */
  effectArea: LoginArea;
  headline: string;
  tagline: string;
  title: string;
  subtitle: string;
  textColor: string;
  card: LoginCard;
  buttonBg: string;
  buttonText: string;
  headlineFont: LoginFont;
  headlineSize: number;
  taglineFont: LoginFont;
  taglineSize: number;
  titleFont: LoginFont;
  titleSize: number;
  subtitleFont: LoginFont;
  subtitleSize: number;
}

export const DEFAULT_LOGIN: LoginTheme = {
  from: "#14afcc",
  via: "#0d6fa8",
  to: "#0a2550",
  angle: 135,
  effect: "linhas",
  effectColor: "#9be8ff",
  speed: 5,
  intensity: 6,
  effectArea: "toda",
  headline: "Seu onboarding começa aqui",
  tagline: "Trilhas, conteúdos e avaliações para você chegar pronto ao dia a dia.",
  title: "Entrar na plataforma",
  subtitle: "Use a sua conta Google. O acesso é liberado pelo administrador para o e-mail cadastrado.",
  textColor: "#ffffff",
  card: "vidro",
  buttonBg: "#ffffff",
  buttonText: "#0a2550",
  headlineFont: "padrao",
  headlineSize: 32,
  taglineFont: "padrao",
  taglineSize: 15,
  titleFont: "padrao",
  titleSize: 18,
  subtitleFont: "padrao",
  subtitleSize: 13.5,
};

export const LOGIN_EFFECT_LABEL: Record<LoginEffect, string> = {
  linhas: "Linhas de luz na grade",
  fluxo: "Linhas passando (diagonal)",
  ondas: "Ondas",
  constelacao: "Constelação (pontos ligados)",
  bokeh: "Luzes flutuantes",
  aurora: "Aurora (brilhos suaves)",
  nenhum: "Sem animação",
};

export const LOGIN_AREA_LABEL: Record<LoginArea, string> = {
  toda: "Página toda",
  esquerda: "Só o lado esquerdo",
  direita: "Só o lado direito",
  superior: "Só a parte de cima",
  inferior: "Só a parte de baixo",
  bordas: "Nas bordas (centro livre)",
  centro: "Só no centro",
};

/** Máscara CSS que limita o efeito à área escolhida (com transição suave). */
export const AREA_MASK: Record<LoginArea, string | undefined> = {
  toda: undefined,
  esquerda: "linear-gradient(to right, #000 0%, #000 32%, transparent 62%)",
  direita: "linear-gradient(to left, #000 0%, #000 32%, transparent 62%)",
  superior: "linear-gradient(to bottom, #000 0%, #000 28%, transparent 60%)",
  inferior: "linear-gradient(to top, #000 0%, #000 28%, transparent 60%)",
  bordas: "radial-gradient(ellipse 50% 55% at 50% 50%, transparent 45%, #000 100%)",
  centro: "radial-gradient(ellipse 55% 60% at 50% 50%, #000 35%, transparent 80%)",
};

/** Fontes oferecidas (Google Fonts, carregadas só quando escolhidas). */
export const LOGIN_FONTS: Record<LoginFont, { label: string; family: string; google?: string }> = {
  padrao: { label: "Padrão do sistema (Inter)", family: "var(--font-sans)" },
  poppins: { label: "Poppins", family: "'Poppins'", google: "Poppins:wght@400;500;600;700" },
  montserrat: { label: "Montserrat", family: "'Montserrat'", google: "Montserrat:wght@400;500;600;700" },
  jakarta: { label: "Plus Jakarta Sans", family: "'Plus Jakarta Sans'", google: "Plus+Jakarta+Sans:wght@400;500;600;700" },
  dmsans: { label: "DM Sans", family: "'DM Sans'", google: "DM+Sans:wght@400;500;600;700" },
  nunito: { label: "Nunito", family: "'Nunito'", google: "Nunito:wght@400;600;700" },
  raleway: { label: "Raleway", family: "'Raleway'", google: "Raleway:wght@400;500;600;700" },
  roboto: { label: "Roboto", family: "'Roboto'", google: "Roboto:wght@400;500;700" },
  lato: { label: "Lato", family: "'Lato'", google: "Lato:wght@400;700" },
  spacegrotesk: { label: "Space Grotesk", family: "'Space Grotesk'", google: "Space+Grotesk:wght@400;500;600;700" },
  playfair: { label: "Playfair Display (serifada)", family: "'Playfair Display'", google: "Playfair+Display:wght@400;600;700" },
  merriweather: { label: "Merriweather (serifada)", family: "'Merriweather'", google: "Merriweather:wght@400;700" },
};

/** Tamanho (px) permitido para cada texto. */
export const TEXT_SIZE: Record<LoginTextKey, { min: number; max: number; label: string }> = {
  headline: { min: 20, max: 56, label: "Chamada" },
  tagline: { min: 12, max: 22, label: "Frase de apoio" },
  title: { min: 14, max: 30, label: "Título do cartão" },
  subtitle: { min: 11, max: 18, label: "Texto do cartão" },
};

export const TEXT_KEYS = ["headline", "tagline", "title", "subtitle"] as const;

export function fontFamily(f: LoginFont): string {
  const def = LOGIN_FONTS[f] ?? LOGIN_FONTS.padrao;
  return f === "padrao" ? def.family : `${def.family}, var(--font-sans)`;
}

/** Folha do Google Fonts com as fontes usadas (null se só a padrão). */
export function fontsUrl(t: LoginTheme): string | null {
  const fams = [...new Set(TEXT_KEYS.map((k) => LOGIN_FONTS[t[`${k}Font`]]?.google).filter(Boolean))];
  return fams.length ? `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${f}`).join("&")}&display=swap` : null;
}

export const LOGIN_CARD_LABEL: Record<LoginCard, string> = {
  vidro: "Vidro (translúcido)",
  claro: "Claro",
  escuro: "Escuro",
};

const HEX = /^#[0-9a-f]{6}$/i;
const COLORS = ["from", "via", "to", "effectColor", "textColor", "buttonBg", "buttonText"] as const;
export const TEXT_LIMITS = { headline: 80, tagline: 200, title: 60, subtitle: 240 } as const;

/** Mantém só valores válidos; o resto cai no padrão. */
export function sanitizeLogin(raw: unknown): Partial<LoginTheme> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<LoginTheme> = {};
  for (const k of COLORS) {
    const v = r[k];
    if (typeof v === "string" && HEX.test(v)) out[k] = v.toLowerCase();
  }
  const int = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(max, Math.max(min, v))) : undefined);
  const angle = int(r.angle, 0, 360);
  if (angle !== undefined) out.angle = angle;
  const speed = int(r.speed, 1, 10);
  if (speed !== undefined) out.speed = speed;
  const intensity = int(r.intensity, 1, 10);
  if (intensity !== undefined) out.intensity = intensity;
  if (typeof r.effect === "string" && Object.hasOwn(LOGIN_EFFECT_LABEL, r.effect)) out.effect = r.effect as LoginEffect;
  if (typeof r.effectArea === "string" && Object.hasOwn(LOGIN_AREA_LABEL, r.effectArea)) out.effectArea = r.effectArea as LoginArea;
  for (const k of TEXT_KEYS) {
    const f = r[`${k}Font`];
    if (typeof f === "string" && Object.hasOwn(LOGIN_FONTS, f)) out[`${k}Font`] = f as LoginFont;
    const size = r[`${k}Size`];
    if (typeof size === "number" && Number.isFinite(size)) {
      const lim = TEXT_SIZE[k];
      out[`${k}Size`] = Math.round(Math.min(lim.max, Math.max(lim.min, size)) * 2) / 2;
    }
  }
  if (r.card === "vidro" || r.card === "claro" || r.card === "escuro") out.card = r.card;
  for (const [k, max] of Object.entries(TEXT_LIMITS) as [keyof typeof TEXT_LIMITS, number][]) {
    const v = r[k];
    if (typeof v === "string") out[k] = v.replace(/\s+/g, " ").trim().slice(0, max);
  }
  return out;
}

export function resolveLogin(saved: Partial<LoginTheme> | undefined): LoginTheme {
  return { ...DEFAULT_LOGIN, ...(saved ?? {}) };
}

/** Só o que difere do padrão (para gravar). */
export function diffLogin(t: Partial<LoginTheme>): Partial<LoginTheme> {
  const clean = sanitizeLogin(t);
  const out: Partial<LoginTheme> = {};
  for (const k of Object.keys(clean) as (keyof LoginTheme)[]) {
    if (clean[k] !== DEFAULT_LOGIN[k]) (out as Record<string, unknown>)[k] = clean[k];
  }
  return out;
}

export function gradientCss(t: Pick<LoginTheme, "from" | "via" | "to" | "angle">): string {
  return `linear-gradient(${t.angle}deg, ${t.from} 0%, ${t.via} 55%, ${t.to} 100%)`;
}

function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgbOf(a);
  const [r2, g2, b2] = rgbOf(b);
  return [r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t].map((v) => Math.round(v)).join(" ");
}
const triplet = (hex: string) => rgbOf(hex).join(" ");

/**
 * Variáveis de cor do cartão (mesmos nomes dos tokens do tema), para que
 * textos e bordas dentro dele combinem com o estilo escolhido.
 */
export function cardVars(t: LoginTheme): Record<string, string> {
  if (t.card === "claro") return { "--ink": "15 23 42", "--heading": "11 18 32", "--muted": "91 107 128", "--line": "226 232 240", "--surface": "255 255 255" };
  if (t.card === "escuro") return { "--ink": "230 237 247", "--heading": "255 255 255", "--muted": "159 176 198", "--line": "36 50 74", "--surface": "15 26 46" };
  return {
    "--ink": triplet(t.textColor),
    "--heading": triplet(t.textColor),
    "--muted": mix(t.textColor, t.via, 0.3),
    "--line": mix(t.textColor, t.via, 0.7),
    "--surface": triplet(t.via),
  };
}

export const CARD_CLASS: Record<LoginCard, string> = {
  vidro: "border-white/25 bg-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.45)] backdrop-blur-xl",
  claro: "border-white/60 bg-white shadow-[0_24px_60px_-24px_rgba(0,0,0,0.5)]",
  escuro: "border-white/10 bg-[#0b1426]/85 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] backdrop-blur-xl",
};
