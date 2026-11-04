/**
 * Tamanho de exibição das logos. Cada variante tem limites absolutos de
 * largura e altura; como a proporção da imagem é mantida, a faixa permitida
 * de cada lado depende dessa proporção (ver sizeRange). Os mesmos limites
 * estão no banco (private.valid_logo_sizes).
 */

export const LOGO_SLOTS = ["logo", "logo_dark", "symbol", "symbol_dark"] as const;
export type LogoSlot = (typeof LOGO_SLOTS)[number];

export interface Size {
  w: number;
  h: number;
}
export type LogoSizes = Partial<Record<LogoSlot, Size>>;

interface Limits {
  wMin: number;
  wMax: number;
  hMin: number;
  hMax: number;
}

export const LIMITS: Record<"logo" | "symbol", Limits> = {
  /** Menu aberto e tela de login. O menu tem 252px; sobram ~220px úteis. */
  logo: { wMin: 80, wMax: 220, hMin: 20, hMax: 80 },
  /** Menu recolhido, com 76px de largura. */
  symbol: { wMin: 24, wMax: 52, hMin: 24, hMax: 52 },
};

export const kindOf = (slot: LogoSlot): "logo" | "symbol" => (slot.startsWith("symbol") ? "symbol" : "logo");

/**
 * Faixa permitida para a imagem com proporção `ratio` (largura ÷ altura).
 * Ex.: logo com proporção 4:1 → largura de 80 a 220, altura de 20 a 55.
 */
export function sizeRange(slot: LogoSlot, ratio: number): Limits {
  const L = LIMITS[kindOf(slot)];
  const r = ratio > 0 && Number.isFinite(ratio) ? ratio : 1;
  let wMin = Math.max(L.wMin, L.hMin * r);
  let wMax = Math.min(L.wMax, L.hMax * r);
  // Proporção muito fora do padrão: usa o único tamanho que mais se aproxima.
  if (wMin > wMax) wMin = wMax = Math.min(L.wMax, Math.max(L.wMin, L.hMax * r));
  wMin = Math.ceil(wMin);
  wMax = Math.floor(Math.max(wMin, wMax));
  return {
    wMin,
    wMax,
    hMin: clampInt(Math.round(wMin / r), L.hMin, L.hMax),
    hMax: clampInt(Math.round(wMax / r), L.hMin, L.hMax),
  };
}

function clampInt(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(v)));
}

/** Tamanho a partir da largura desejada, mantendo a proporção e os limites. */
export function fromWidth(slot: LogoSlot, ratio: number, w: number): Size {
  const R = sizeRange(slot, ratio);
  const L = LIMITS[kindOf(slot)];
  const width = clampInt(w, R.wMin, R.wMax);
  return { w: width, h: clampInt(width / (ratio > 0 ? ratio : 1), L.hMin, L.hMax) };
}

/** Tamanho a partir da altura desejada, mantendo a proporção e os limites. */
export function fromHeight(slot: LogoSlot, ratio: number, h: number): Size {
  const r = ratio > 0 ? ratio : 1;
  return fromWidth(slot, ratio, h * r);
}

/** Tamanho inicial ao enviar uma imagem: logo com 175px de largura; símbolo com 36px de altura. */
export function defaultSize(slot: LogoSlot, ratio: number): Size {
  return kindOf(slot) === "logo" ? fromWidth(slot, ratio, 175) : fromHeight(slot, ratio, 36);
}

/** Aceita só variantes conhecidas com números inteiros dentro dos limites absolutos. */
export function sanitizeSizes(input: unknown): LogoSizes {
  const out: LogoSizes = {};
  if (!input || typeof input !== "object") return out;
  for (const slot of LOGO_SLOTS) {
    const v = (input as Record<string, unknown>)[slot] as { w?: unknown; h?: unknown } | undefined;
    if (!v || typeof v.w !== "number" || typeof v.h !== "number") continue;
    const L = LIMITS[kindOf(slot)];
    if (Number.isInteger(v.w) && Number.isInteger(v.h) && v.w >= L.wMin && v.w <= L.wMax && v.h >= L.hMin && v.h <= L.hMax) {
      out[slot] = { w: v.w, h: v.h };
    }
  }
  return out;
}
