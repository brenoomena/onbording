/**
 * Modelo do certificado de conclusão. Puro: usado na tela (HTML), no PDF
 * (servidor) e no editor de Configurações. As medidas seguem uma folha A4
 * deitada em pontos (842 × 595): a tela e o PDF usam os mesmos números.
 */

export type NameStyle = "serifada" | "sem_serifa";

export interface CertificateTheme {
  title: string;
  subtitle: string;
  intro: string;
  /** Texto com marcadores: {trilha} {carga} {data} {media} {nome}. */
  body: string;
  /** Frase da média; só aparece quando a trilha tem avaliação. */
  scoreText: string;
  showHours: boolean;
  showScore: boolean;
  showQr: boolean;
  primary: string;
  accent: string;
  ink: string;
  nameStyle: NameStyle;
  signerName: string;
  signerRole: string;
  signaturePath: string | null;
}

export const DEFAULT_CERTIFICATE: CertificateTheme = {
  title: "Certificado",
  subtitle: "de conclusão",
  intro: "Certificamos que",
  body: "concluiu a trilha {trilha}, com carga horária de {carga}, em {data}.",
  scoreText: "Média nas avaliações: {media}.",
  showHours: true,
  showScore: true,
  showQr: true,
  primary: "#0a2550",
  accent: "#14afcc",
  ink: "#1e293b",
  nameStyle: "serifada",
  signerName: "",
  signerRole: "",
  signaturePath: null,
};

export const CERT_LIMITS = { title: 40, subtitle: 60, intro: 80, body: 400, scoreText: 120, signerName: 80, signerRole: 80 } as const;

export const PAGE = { w: 842, h: 595 } as const;

const HEX = /^#[0-9a-f]{6}$/i;
const SIGNATURE = /^logo\/[0-9a-f-]{36}\.png$/;

export function sanitizeCertificate(raw: unknown): Partial<CertificateTheme> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<CertificateTheme> = {};
  for (const [k, max] of Object.entries(CERT_LIMITS) as [keyof typeof CERT_LIMITS, number][]) {
    const v = r[k];
    if (typeof v === "string") out[k] = v.replace(/[ \t]+/g, " ").trim().slice(0, max);
  }
  for (const k of ["primary", "accent", "ink"] as const) {
    const v = r[k];
    if (typeof v === "string" && HEX.test(v)) out[k] = v.toLowerCase();
  }
  for (const k of ["showHours", "showScore", "showQr"] as const) {
    if (typeof r[k] === "boolean") out[k] = r[k] as boolean;
  }
  if (r.nameStyle === "serifada" || r.nameStyle === "sem_serifa") out.nameStyle = r.nameStyle;
  if (r.signaturePath === null || (typeof r.signaturePath === "string" && SIGNATURE.test(r.signaturePath))) out.signaturePath = r.signaturePath as string | null;
  return out;
}

export function resolveCertificate(saved: Partial<CertificateTheme> | undefined): CertificateTheme {
  return { ...DEFAULT_CERTIFICATE, ...(saved ?? {}) };
}

export function diffCertificate(t: Partial<CertificateTheme>): Partial<CertificateTheme> {
  const clean = sanitizeCertificate(t);
  const out: Partial<CertificateTheme> = {};
  for (const k of Object.keys(clean) as (keyof CertificateTheme)[]) {
    if (clean[k] !== DEFAULT_CERTIFICATE[k]) (out as Record<string, unknown>)[k] = clean[k];
  }
  return out;
}

/** Dados de um certificado emitido (cópia guardada no banco). */
export interface CertificateData {
  code: string;
  person_name: string;
  track_name: string;
  hours: number | null;
  average_score: number | null;
  completed_at: string;
  issued_at: string;
}

export const SAMPLE_CERTIFICATE: CertificateData = {
  code: "A1B2-C3D4-E5F6",
  person_name: "Maria Aparecida da Silva",
  track_name: "Onboarding Comercial",
  hours: 12,
  average_score: 92.5,
  completed_at: "2026-11-05T15:00:00Z",
  issued_at: "2026-11-05T15:00:00Z",
};

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "5 de novembro de 2026" (horário de Brasília). */
export function longDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

export function shortDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

/** 12 → "12 horas"; 1.5 → "1h30"; 0.5 → "30 minutos". */
export function formatHours(h: number | null): string | null {
  if (h === null || !Number.isFinite(h) || h <= 0) return null;
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  if (hh === 0) return `${mm} minutos`;
  if (mm === 0) return `${hh} ${hh === 1 ? "hora" : "horas"}`;
  return `${hh}h${String(mm).padStart(2, "0")}`;
}

export function formatScore(s: number | null): string | null {
  if (s === null || !Number.isFinite(s)) return null;
  return `${Number.isInteger(s) ? s : s.toFixed(1).replace(".", ",")}%`;
}

/** Pedaço de texto; `strong` marca os dados preenchidos (nome da trilha etc.). */
export interface Segment {
  text: string;
  strong: boolean;
}

/**
 * Preenche os marcadores. Sem carga horária, a parte "com carga horária de
 * {carga}" é retirada da frase para não ficar um buraco.
 */
export function fillText(template: string, d: CertificateData, t: Pick<CertificateTheme, "showHours">): Segment[] {
  const hours = t.showHours ? formatHours(d.hours) : null;
  let text = template;
  if (!hours) text = text.replace(/,?\s*com carga hor[áa]ria de \{carga\}/i, "").replace(/\{carga\}/g, "");
  const values: Record<string, string | null> = {
    trilha: d.track_name,
    carga: hours,
    data: longDate(d.completed_at),
    media: formatScore(d.average_score),
    nome: d.person_name,
  };
  const out: Segment[] = [];
  const re = /\{(trilha|carga|data|media|nome)\}/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), strong: false });
    const v = values[m[1]];
    if (v) out.push({ text: v, strong: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), strong: false });
  return out.filter((s) => s.text.length > 0);
}

export function scoreSegments(d: CertificateData, t: CertificateTheme): Segment[] | null {
  if (!t.showScore || d.average_score === null || !t.scoreText) return null;
  return fillText(t.scoreText, d, t);
}

export function validationPath(code: string): string {
  return `/certificado/${code}`;
}

/**
 * Posições (em pontos, a partir do topo) usadas igualmente pela tela e pelo
 * PDF. A tela converte para % da largura/altura.
 */
export const LAYOUT = {
  frameOuter: 16,
  frameInner: 25,
  corner: 120,
  logo: { y: 58, maxW: 190, maxH: 50 },
  title: { y: 150, size: 34, spacing: 6 },
  subtitle: { y: 174, size: 12.5, spacing: 3 },
  intro: { y: 222, size: 13 },
  name: { y: 266, size: 32 },
  rule: { y: 284, w: 300 },
  body: { y: 316, size: 13, line: 19.5, maxW: 580 },
  sign: { cx: 232, lineY: 506, lineW: 190, img: { maxW: 160, maxH: 44 } },
  verify: { right: 676, qr: { x: 690, y: 456, size: 64 } },
} as const;

/** Matriz do QR code como caminho SVG (1 unidade = 1 módulo). */
export function qrPath(modules: { size: number; get: (r: number, c: number) => number | boolean }): string {
  let d = "";
  for (let r = 0; r < modules.size; r++) {
    for (let c = 0; c < modules.size; c++) if (modules.get(r, c)) d += `M${c} ${r}h1v1h-1z`;
  }
  return d;
}

/** Título longo diminui para caber (mesma regra na tela e no PDF). */
export function titleScale(title: string): number {
  const n = [...title].length;
  return n <= 20 ? 1 : Math.max(0.55, 20 / n);
}
