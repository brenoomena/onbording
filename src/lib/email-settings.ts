/**
 * Configuração dos e-mails (Configurações › E-mails), guardada em
 * app_settings.email_settings. Puro: servidor e navegador.
 */

export const EMAIL_KINDS = [
  { key: "matricula", label: "Matrícula nova", hint: "Quando a pessoa é matriculada numa trilha publicada, com o prazo e o link.", optional: false },
  { key: "prazo", label: "Prazo chegando", hint: "Lembrete antes do prazo e no dia, enquanto a trilha não estiver concluída.", optional: true },
  { key: "atraso", label: "Prazo vencido", hint: "Um e-mail no dia seguinte ao prazo (atrasos de até 7 dias).", optional: true },
  { key: "comunicado", label: "Comunicado importante", hint: "Comunicados marcados como importantes, ao publicar.", optional: true },
  { key: "resumo", label: "Resumo semanal ao gestor", hint: "Toda segunda-feira, para quem tem equipe: atrasos, andamento e conclusões da semana.", optional: true },
] as const;
export type EmailKindKey = (typeof EMAIL_KINDS)[number]["key"];

export const REMINDER_OPTIONS = [7, 3, 1, 0] as const;
export const reminderLabel = (d: number) => (d === 0 ? "No dia" : d === 1 ? "1 dia antes" : `${d} dias antes`);

export interface EmailSettings {
  kinds: Record<EmailKindKey, boolean>;
  reminderDays: number[];
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  kinds: { matricula: true, prazo: true, atraso: true, comunicado: true, resumo: true },
  reminderDays: [3, 0],
};

export function sanitizeEmailSettings(v: unknown): EmailSettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const k = (o.kinds && typeof o.kinds === "object" ? o.kinds : {}) as Record<string, unknown>;
  const kinds = Object.fromEntries(EMAIL_KINDS.map((x) => [x.key, typeof k[x.key] === "boolean" ? k[x.key] : true])) as Record<EmailKindKey, boolean>;
  const raw = Array.isArray(o.reminder_days) ? o.reminder_days : Array.isArray(o.reminderDays) ? o.reminderDays : null;
  const days = raw
    ? [...new Set(raw.map(Number).filter((d) => (REMINDER_OPTIONS as readonly number[]).includes(d)))].sort((a, b) => b - a)
    : DEFAULT_EMAIL_SETTINGS.reminderDays;
  return { kinds, reminderDays: days };
}

/** Formato gravado no banco (o mesmo que as funções do banco leem). */
export function toDb(s: EmailSettings): { kinds: Record<EmailKindKey, boolean>; reminder_days: number[] } {
  return { kinds: s.kinds, reminder_days: s.reminderDays };
}
