/** Pesquisa de satisfação: tipos, filtros e contas. Puro: servidor e navegador. */

export const RATING_LABEL: Record<number, string> = {
  1: "Muito ruim",
  2: "Ruim",
  3: "Regular",
  4: "Boa",
  5: "Excelente",
};

export const TRACK_COMMENT_MAX = 1000;
export const CONTENT_COMMENT_MAX = 500;

export type Dist = [number, number, number, number, number];

export interface FeedbackRow {
  responses: number;
  avg: number | null;
  dist: Dist;
  comments: number;
}
export interface TrackFeedbackRow extends FeedbackRow {
  id: string;
  name: string;
  completions: number;
}
export interface ContentFeedbackRow extends FeedbackRow {
  id: string;
  title: string;
  kind: string;
}
export interface FeedbackComment {
  kind: "trilha" | "conteudo";
  item_id: string;
  item: string;
  rating: number;
  comment: string;
  at: string;
  author: string | null;
  area: string | null;
}
export interface FeedbackReport {
  summary: {
    track_responses: number;
    track_avg: number | null;
    track_dist: Dist;
    completions: number;
    content_responses: number;
    content_avg: number | null;
  };
  tracks: TrackFeedbackRow[];
  contents: ContentFeedbackRow[];
  comments: FeedbackComment[];
}

/** Nota 1–5 vinda de formulário; fora disso, null. */
export function parseRating(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

/** Comentário limpo (sem espaços sobrando); vazio vira null. */
export function cleanComment(v: unknown, max: number): { value: string | null; error?: string } {
  const s = typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : "";
  if (s.length > max) return { value: null, error: `Use no máximo ${max.toLocaleString("pt-BR")} caracteres no comentário.` };
  return { value: s || null };
}

/** Taxa de resposta em % (0–100), ou null sem conclusões. */
export function responseRate(responses: number, completions: number): number | null {
  if (!completions) return null;
  return Math.min(100, Math.round((responses / completions) * 100));
}

/** % de cada nota (1 a 5), somando 100 quando há respostas. */
export function distPercent(dist: Dist): number[] {
  const total = dist.reduce((a, b) => a + b, 0);
  if (!total) return [0, 0, 0, 0, 0];
  return dist.map((n) => Math.round((n / total) * 100));
}

/** "4,3" */
export function formatAvg(v: number | null | undefined): string {
  return v == null ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export interface FeedbackFilters {
  from: string | null;
  to: string | null;
  area: string | null;
  /** Período rápido: 30, 90, 365 dias ou "tudo". */
  periodo: "30" | "90" | "365" | "tudo" | "personalizado";
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

function minusDays(today: string, days: number): string {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Filtros da tela a partir da URL. Padrão: últimos 90 dias. */
export function parseFeedbackFilters(sp: Record<string, string | string[] | undefined>, today: string): FeedbackFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) as string | undefined;
  const area = isId(one("area")) ? one("area")! : null;
  const p = one("periodo");
  if (p === "personalizado" || (!p && (isDate(one("de")) || isDate(one("ate"))))) {
    let from = isDate(one("de")) ? one("de")! : null;
    let to = isDate(one("ate")) ? one("ate")! : null;
    if (from && to && from > to) [from, to] = [to, from];
    return { from, to, area, periodo: "personalizado" };
  }
  if (p === "tudo") return { from: null, to: null, area, periodo: "tudo" };
  const days = p === "30" ? 30 : p === "365" ? 365 : 90;
  return { from: minusDays(today, days - 1), to: today, area, periodo: String(days) as "30" | "90" | "365" };
}

/** Normaliza o JSON do banco (números podem vir como texto). */
export function normalizeReport(raw: unknown): FeedbackReport {
  const r = (raw ?? {}) as Partial<FeedbackReport> & { summary?: Partial<FeedbackReport["summary"]> };
  const num = (v: unknown) => (v == null ? null : Number(v));
  const dist = (v: unknown): Dist => {
    const a = Array.isArray(v) ? v.map((x) => Number(x) || 0) : [];
    return [a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, a[3] ?? 0, a[4] ?? 0];
  };
  const s: Partial<FeedbackReport["summary"]> = r.summary ?? {};
  return {
    summary: {
      track_responses: Number(s.track_responses ?? 0),
      track_avg: num(s.track_avg),
      track_dist: dist(s.track_dist),
      completions: Number(s.completions ?? 0),
      content_responses: Number(s.content_responses ?? 0),
      content_avg: num(s.content_avg),
    },
    tracks: (r.tracks ?? []).map((t) => ({ ...t, responses: Number(t.responses), completions: Number(t.completions), comments: Number(t.comments), avg: num(t.avg), dist: dist(t.dist) })),
    contents: (r.contents ?? []).map((c) => ({ ...c, responses: Number(c.responses), comments: Number(c.comments), avg: num(c.avg), dist: dist(c.dist) })),
    comments: (r.comments ?? []).map((c) => ({ ...c, rating: Number(c.rating) })),
  };
}

/** Filtro dos comentários: por nota (1–5), por tipo e por item. */
export function filterComments(list: FeedbackComment[], sp: { nota?: string; tipo?: string; item?: string }): FeedbackComment[] {
  const nota = Number(sp.nota);
  return list.filter(
    (c) =>
      (!Number.isInteger(nota) || nota < 1 || nota > 5 || c.rating === nota) &&
      (sp.tipo !== "trilha" && sp.tipo !== "conteudo" ? true : c.kind === sp.tipo) &&
      (!sp.item || c.item_id === sp.item),
  );
}
