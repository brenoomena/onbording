/** Tipos de aviso da central (sininho). Puro: servidor e navegador. */
export type NotificationKind =
  | "matricula"
  | "prazo_proximo"
  | "prazo_vencido"
  | "correcao_pendente"
  | "avaliacao_corrigida"
  | "certificado"
  | "comunicado"
  | "medalha"
  | "equipe_atraso";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read_at: string | null;
}

export const NOTIFICATION_LABEL: Record<NotificationKind, string> = {
  matricula: "Nova trilha",
  prazo_proximo: "Prazo chegando",
  prazo_vencido: "Prazo vencido",
  correcao_pendente: "Correção pendente",
  avaliacao_corrigida: "Avaliação corrigida",
  certificado: "Certificado",
  comunicado: "Comunicado",
  medalha: "Medalha",
  equipe_atraso: "Atraso na equipe",
};

export const NOTIFICATION_TONE: Record<NotificationKind, "blue" | "warn" | "danger" | "violet" | "ok" | "teal" | "orange"> = {
  matricula: "blue",
  prazo_proximo: "warn",
  prazo_vencido: "danger",
  correcao_pendente: "violet",
  avaliacao_corrigida: "teal",
  certificado: "ok",
  comunicado: "orange",
  medalha: "warn",
  equipe_atraso: "danger",
};

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias", depois a data. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "agora";
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  const dt = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}/${dt.getUTCFullYear()}`;
}

/** Só caminhos internos (evita link para fora vindo do banco). */
export function safeLink(link: string | null): string | null {
  return link && /^\/(?!\/)[A-Za-z0-9/_?=&%.-]*$/.test(link) ? link : null;
}
