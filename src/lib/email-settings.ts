/**
 * Configuração dos e-mails (Configurações › E-mails), guardada em
 * app_settings.email_settings. Puro: servidor e navegador.
 */

export const EMAIL_KINDS = [
  { key: "matricula", label: "Matrícula nova", hint: "Quando a pessoa é matriculada numa trilha publicada, com o prazo e o link.", optional: false },
  { key: "prazo", label: "Prazo chegando", hint: "Lembrete antes do prazo e no dia, enquanto a trilha não estiver concluída.", optional: true },
  { key: "atraso", label: "Prazo vencido", hint: "Um e-mail no dia seguinte ao prazo (atrasos de até 7 dias).", optional: true },
  { key: "equipe", label: "Atraso na equipe (supervisor)", hint: "Assim que a trilha de alguém da equipe atrasa, o supervisor recebe um aviso (o do sininho sai sempre).", optional: true },
  { key: "comunicado", label: "Comunicado importante", hint: "Comunicados marcados como importantes, ao publicar.", optional: true },
  { key: "resumo", label: "Resumo semanal ao gestor", hint: "Toda segunda-feira, para quem tem equipe: atrasos, andamento e conclusões da semana.", optional: true },
] as const;
export type EmailKindKey = (typeof EMAIL_KINDS)[number]["key"];

export const REMINDER_OPTIONS = [7, 3, 1, 0] as const;
export const reminderLabel = (d: number) => (d === 0 ? "No dia" : d === 1 ? "1 dia antes" : `${d} dias antes`);

export interface EmailSettings {
  kinds: Record<EmailKindKey, boolean>;
  reminderDays: number[];
  theme: EmailTheme;
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  kinds: { matricula: true, prazo: true, atraso: true, equipe: true, comunicado: true, resumo: true },
  reminderDays: [3, 0],
  get theme() {
    return DEFAULT_EMAIL_THEME;
  },
};

export function sanitizeEmailSettings(v: unknown): EmailSettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const k = (o.kinds && typeof o.kinds === "object" ? o.kinds : {}) as Record<string, unknown>;
  const kinds = Object.fromEntries(EMAIL_KINDS.map((x) => [x.key, typeof k[x.key] === "boolean" ? k[x.key] : true])) as Record<EmailKindKey, boolean>;
  const raw = Array.isArray(o.reminder_days) ? o.reminder_days : Array.isArray(o.reminderDays) ? o.reminderDays : null;
  const days = raw
    ? [...new Set(raw.map(Number).filter((d) => (REMINDER_OPTIONS as readonly number[]).includes(d)))].sort((a, b) => b - a)
    : DEFAULT_EMAIL_SETTINGS.reminderDays;
  return { kinds, reminderDays: days, theme: sanitizeEmailTheme(o.theme) };
}

/** Formato gravado no banco (o mesmo que as funções do banco leem). */
export function toDb(s: EmailSettings): { kinds: Record<EmailKindKey, boolean>; reminder_days: number[]; theme: EmailTheme } {
  return { kinds: s.kinds, reminder_days: s.reminderDays, theme: s.theme };
}

// ------------------------------------------------------------------ visual
export const EMAIL_LAYOUTS = [
  { key: "cartao", label: "Cartão", hint: "Cabeçalho claro com linha colorida" },
  { key: "faixa", label: "Faixa", hint: "Cabeçalho todo na cor escolhida" },
  { key: "minimalista", label: "Minimalista", hint: "Sem cartão, só o conteúdo" },
] as const;
export type EmailLayout = (typeof EMAIL_LAYOUTS)[number]["key"];
export type EmailLogoSource = "marca" | "propria" | "nenhuma";
export type EmailAlign = "esquerda" | "centro";

export interface EmailTheme {
  /** Nome que aparece como remetente ("Onboarding Implantta"). */
  senderName: string;
  layout: EmailLayout;
  logoSource: EmailLogoSource;
  logoPath: string | null;
  logoHeight: number;
  logoAlign: EmailAlign;
  /** Cor do cabeçalho (fundo da faixa, no layout Faixa). */
  header: string;
  /** Cor do botão e dos destaques; "" = cor da marca. */
  accent: string;
  text: string;
  background: string;
  card: string;
  /** Saudação; {nome} vira o primeiro nome da pessoa. */
  greeting: string;
  signature: string;
  footer: string;
}

export const EMAIL_LIMITS = { senderName: 60, greeting: 60, signature: 120, footer: 300 } as const;

export const DEFAULT_EMAIL_THEME: EmailTheme = {
  senderName: "Onboarding Implantta",
  layout: "cartao",
  logoSource: "marca",
  logoPath: null,
  logoHeight: 36,
  logoAlign: "esquerda",
  header: "#ffffff",
  accent: "",
  text: "#1e293b",
  background: "#f3f5f8",
  card: "#ffffff",
  greeting: "Olá, {nome}!",
  signature: "Equipe de Onboarding Implantta",
  footer: "",
};

const HEX = /^#[0-9a-f]{6}$/i;
const EMAIL_LOGO = /^logo\/[0-9a-f-]{36}\.png$/;

/** Texto de uma linha: sem quebras, sem < > (que viram tags no nome do remetente). */
const line = (v: unknown, max: number, fallback: string) =>
  typeof v === "string" ? v.replace(/[\r\n\t<>"]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : fallback;

export function sanitizeEmailTheme(v: unknown): EmailTheme {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const d = DEFAULT_EMAIL_THEME;
  const pick = <T extends string>(x: unknown, list: readonly T[], f: T): T => (typeof x === "string" && (list as readonly string[]).includes(x) ? (x as T) : f);
  const hex = (x: unknown, f: string) => (typeof x === "string" && HEX.test(x) ? x.toLowerCase() : f);
  const senderName = line(o.senderName, EMAIL_LIMITS.senderName, d.senderName);
  return {
    senderName: senderName || d.senderName,
    layout: pick(o.layout, EMAIL_LAYOUTS.map((l) => l.key), d.layout),
    logoSource: pick(o.logoSource, ["marca", "propria", "nenhuma"] as const, d.logoSource),
    logoPath: typeof o.logoPath === "string" && EMAIL_LOGO.test(o.logoPath) ? o.logoPath : null,
    logoHeight: Math.min(80, Math.max(20, Math.round(Number(o.logoHeight) || d.logoHeight))),
    logoAlign: pick(o.logoAlign, ["esquerda", "centro"] as const, d.logoAlign),
    header: hex(o.header, d.header),
    accent: o.accent === "" ? "" : hex(o.accent, d.accent),
    text: hex(o.text, d.text),
    background: hex(o.background, d.background),
    card: hex(o.card, d.card),
    greeting: line(o.greeting, EMAIL_LIMITS.greeting, d.greeting),
    signature: line(o.signature, EMAIL_LIMITS.signature, d.signature),
    footer: typeof o.footer === "string" ? o.footer.replace(/[<>]/g, "").replace(/\r/g, "").trim().slice(0, EMAIL_LIMITS.footer) : d.footer,
  };
}

/** "Nome" <endereco>, a partir do EMAIL_FROM (com ou sem nome) e do nome escolhido. */
export function fromHeader(emailFrom: string, senderName: string): string {
  const raw = emailFrom.trim();
  const address = (raw.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1] ?? raw).trim();
  const name = line(senderName, EMAIL_LIMITS.senderName, "");
  return name ? `"${name}" <${address}>` : address;
}
