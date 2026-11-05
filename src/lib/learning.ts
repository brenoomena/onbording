/** Tipos, rótulos e utilitários do módulo de aprendizagem (Etapa 2). */

export type PublishStatus = "rascunho" | "publicado" | "arquivado";
export type ContentKind = "texto" | "link" | "video" | "arquivo" | "avaliacao";
export type EnrollmentStatus = "nao_iniciada" | "em_andamento" | "concluida";

export const PUBLISH_LABEL: Record<PublishStatus, string> = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  arquivado: "Arquivado",
};

export const KIND_LABEL: Record<ContentKind, string> = {
  texto: "Texto",
  link: "Link externo",
  video: "Vídeo",
  arquivo: "Arquivo",
  avaliacao: "Avaliação",
};

export const ENROLLMENT_LABEL: Record<EnrollmentStatus, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

export interface ContentRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  kind: ContentKind;
  body: string | null;
  url: string | null;
  storage_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  external_platform: string | null;
  access_note: string | null;
  objective: string | null;
  estimated_minutes: number | null;
  owner_id: string | null;
  is_library: boolean;
  /** Trilha a que o conteúdo pertence (null = só Biblioteca). */
  track_id: string | null;
  status: PublishStatus;
  /** Avaliação: nota mínima (%) e limite de tentativas (null = ilimitadas). */
  passing_score: number;
  max_attempts: number | null;
  updated_at: string;
}

export interface TrackRow {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  audience_note: string | null;
  recommended_level_id: string | null;
  is_mandatory: boolean;
  deadline_days: number | null;
  certificate_hours: number | null;
  is_sequential: boolean;
  status: PublishStatus;
  published_at: string | null;
}

export interface AudienceRule {
  area_id: string | null;
  position_id: string | null;
  level_id: string | null;
}

export interface TrackItem {
  id: string;
  module_id: string;
  position: number;
  is_required: boolean;
  content: Pick<ContentRow, "id" | "title" | "kind" | "external_platform" | "estimated_minutes" | "status" | "category">;
}

export interface TrackModule {
  id: string;
  title: string;
  description: string | null;
  position: number;
  items: TrackItem[];
}

/** Estado de cada item de uma trilha para a pessoa: concluído, liberado ou bloqueado. */
export function itemStates(
  modules: TrackModule[],
  completed: ReadonlySet<string>,
  sequential: boolean,
): Map<string, "concluido" | "liberado" | "bloqueado"> {
  const states = new Map<string, "concluido" | "liberado" | "bloqueado">();
  let blocked = false;
  for (const m of [...modules].sort((a, b) => a.position - b.position)) {
    for (const item of [...m.items].sort((a, b) => a.position - b.position)) {
      const done = completed.has(item.content.id);
      if (done) states.set(item.id, "concluido");
      // Opcionais (materiais de consulta) ficam sempre liberados.
      else states.set(item.id, sequential && blocked && item.is_required ? "bloqueado" : "liberado");
      if (item.is_required && !done) blocked = true;
    }
  }
  return states;
}

/** Vídeos do YouTube e Vimeo: proporção 16:9. O resto (Drive, Docs) usa a altura da tela. */
export function isVideoEmbed(src: string): boolean {
  return src.includes("youtube-nocookie.com") || src.includes("player.vimeo.com");
}

/** Converte links do YouTube, Vimeo, Google Drive e Google Docs em endereços para incorporar na página. */
export function embedUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === "drive.google.com") {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/);
      return m ? `https://drive.google.com/file/d/${m[1]}/preview` : null;
    }
    if (host === "docs.google.com") {
      const m = u.pathname.match(/^\/(document|presentation|spreadsheets)\/d\/([^/]+)/);
      return m ? `https://docs.google.com/${m[1]}/d/${m[2]}/preview` : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function formatMinutes(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(seconds ?? 0));
  if (s < 60) return s === 0 ? "—" : "< 1 min";
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Hoje no fuso de São Paulo, como AAAA-MM-DD. */
export function todayBR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function isOverdue(due: string | null, status: EnrollmentStatus): boolean {
  return !!due && status !== "concluida" && due < todayBR();
}
