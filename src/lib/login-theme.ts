/**
 * Aparência da página de login (e das telas de acesso). Puro: usado no
 * servidor (validação) e no navegador (editor e prévia).
 */

export type LoginEffect = "linhas" | "constelacao" | "nenhum";
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
  headline: string;
  tagline: string;
  title: string;
  subtitle: string;
  textColor: string;
  card: LoginCard;
  buttonBg: string;
  buttonText: string;
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
  headline: "Seu onboarding começa aqui",
  tagline: "Trilhas, conteúdos e avaliações para você chegar pronto ao dia a dia.",
  title: "Entrar na plataforma",
  subtitle: "Use a sua conta Google. O acesso é liberado pelo administrador para o e-mail cadastrado.",
  textColor: "#ffffff",
  card: "vidro",
  buttonBg: "#ffffff",
  buttonText: "#0a2550",
};

export const LOGIN_EFFECT_LABEL: Record<LoginEffect, string> = {
  linhas: "Linhas de luz percorrendo",
  constelacao: "Constelação (pontos ligados)",
  nenhum: "Sem animação",
};

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
  if (r.effect === "linhas" || r.effect === "constelacao" || r.effect === "nenhum") out.effect = r.effect;
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
