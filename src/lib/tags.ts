/**
 * Cores das etiquetas (Badge). Cada tipo de informação usa cores próprias:
 * situação de publicação, situação da matrícula, tipo de material e nível.
 */
export type TagColor = "blue" | "violet" | "teal" | "orange" | "pink" | "indigo" | "silver" | "gold";
export type Tone = "neutral" | "brand" | "ok" | "warn" | "danger" | TagColor;

/** Situação de publicação (trilhas e conteúdos): rascunho laranja, publicado verde, arquivado prata. */
export const PUBLISH_TONE = { rascunho: "orange", publicado: "ok", arquivado: "silver" } as const satisfies Record<string, Tone>;

/** Situação da matrícula: não iniciada prata, em andamento azul, concluída verde (em atraso: vermelho). */
export const ENROLLMENT_TONE = { nao_iniciada: "silver", em_andamento: "blue", concluida: "ok" } as const satisfies Record<string, Tone>;

/** Tipo de material: cada formato com uma cor. */
export const KIND_TONE = { texto: "indigo", link: "teal", video: "pink", arquivo: "violet", avaliacao: "gold" } as const satisfies Record<string, Tone>;

/** Nível do cargo: Júnior azul, Pleno prata, Sênior dourado; outros nomes em azul-violeta. */
export function levelTone(name: string | null | undefined): Tone {
  const n = (name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\bjunior\b|\bjr\b/.test(n)) return "blue";
  if (/\bpleno\b|\bpl\b/.test(n)) return "silver";
  if (/\bsenior\b|\bsr\b/.test(n)) return "gold";
  if (/especialista|lider|coordenador|gerente|master/.test(n)) return "violet";
  return "indigo";
}

