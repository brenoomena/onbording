/**
 * Modelo do certificado de conclusão. Puro: usado na tela (HTML), no PDF
 * (servidor) e no editor de Configurações. As medidas seguem uma folha A4
 * deitada em pontos (842 × 595): a tela e o PDF usam os mesmos números.
 */

export type NameStyle = "serifada" | "sem_serifa";
export type CertModel = "classico" | "moderno" | "elegante" | "minimalista" | "faixa";

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
  model: CertModel;
  /** Logomarca só do certificado (PNG); sem ela, usa a logo da Marca. */
  logoPath: string | null;
  /** Altura da logo no certificado, em pontos. */
  logoHeight: number;
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
  model: "classico",
  logoPath: null,
  logoHeight: 50,
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
  if (r.logoPath === null || (typeof r.logoPath === "string" && SIGNATURE.test(r.logoPath))) out.logoPath = r.logoPath as string | null;
  if (typeof r.model === "string" && Object.hasOwn(CERT_MODELS, r.model)) out.model = r.model as CertModel;
  if (typeof r.logoHeight === "number" && Number.isFinite(r.logoHeight)) out.logoHeight = Math.round(Math.min(70, Math.max(20, r.logoHeight)));
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
  logo: { cy: 83 },
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


/** Cor de uma forma: do tema (primary, accent, ink) ou fixa (#rrggbb). */
export type Paint = "primary" | "accent" | "ink" | `#${string}`;
export type Shape =
  | { kind: "rect"; x: number; y: number; w: number; h: number; fill?: Paint; stroke?: Paint; sw?: number }
  | { kind: "path"; d: string; fill: Paint };

export interface CertModelSpec {
  label: string;
  hint: string;
  paper: string;
  /** Formas decorativas, em pontos com o y a partir do topo (como no SVG). */
  shapes: Shape[];
  /** Centro e meia largura da área dos textos. */
  cx: number;
  half: number;
  signCx: number;
  verifyRight: number;
  qrX: number;
}

const W = PAGE.w;
const H = PAGE.h;
const diamond = (x: number, y: number, r: number) => `M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z`;

export const CERT_MODELS: Record<CertModel, CertModelSpec> = {
  classico: {
    label: "Clássico",
    hint: "Moldura dupla e cantos em diagonal",
    paper: "#ffffff",
    shapes: [
      { kind: "rect", x: 16, y: 16, w: W - 32, h: H - 32, stroke: "primary", sw: 2.2 },
      { kind: "rect", x: 25, y: 25, w: W - 50, h: H - 50, stroke: "accent", sw: 0.7 },
      { kind: "path", d: `M${W - 120} 0H${W}V120Z`, fill: "primary" },
      { kind: "path", d: `M${W - 74.4} 0H${W}V74.4Z`, fill: "accent" },
      { kind: "path", d: `M0 ${H - 120}L120 ${H}H0Z`, fill: "primary" },
      { kind: "path", d: `M0 ${H - 74.4}L74.4 ${H}H0Z`, fill: "accent" },
    ],
    cx: W / 2,
    half: 330,
    signCx: 232,
    verifyRight: 676,
    qrX: 690,
  },
  moderno: {
    label: "Moderno",
    hint: "Faixa lateral na cor principal",
    paper: "#ffffff",
    shapes: [
      { kind: "rect", x: 0, y: 0, w: 228, h: H, fill: "primary" },
      { kind: "rect", x: 228, y: 0, w: 7, h: H, fill: "accent" },
      { kind: "path", d: `M0 ${H - 170}L228 ${H - 60}V${H}H0Z`, fill: "accent" },
      { kind: "rect", x: 40, y: 44, w: 54, h: 4, fill: "accent" },
      { kind: "rect", x: 264, y: 30, w: W - 294, h: H - 60, stroke: "primary", sw: 0.6 },
    ],
    cx: 538,
    half: 262,
    signCx: 390,
    verifyRight: 714,
    qrX: 728,
  },
  elegante: {
    label: "Elegante",
    hint: "Papel creme, moldura tripla e losangos",
    paper: "#fbf7ee",
    shapes: [
      { kind: "rect", x: 18, y: 18, w: W - 36, h: H - 36, stroke: "primary", sw: 1.2 },
      { kind: "rect", x: 26, y: 26, w: W - 52, h: H - 52, stroke: "accent", sw: 3 },
      { kind: "rect", x: 34, y: 34, w: W - 68, h: H - 68, stroke: "primary", sw: 0.5 },
      { kind: "path", d: diamond(26, 26, 11), fill: "accent" },
      { kind: "path", d: diamond(W - 26, 26, 11), fill: "accent" },
      { kind: "path", d: diamond(26, H - 26, 11), fill: "accent" },
      { kind: "path", d: diamond(W - 26, H - 26, 11), fill: "accent" },
      { kind: "path", d: diamond(W / 2, 34, 5), fill: "primary" },
      { kind: "path", d: diamond(W / 2, H - 34, 5), fill: "primary" },
    ],
    cx: W / 2,
    half: 320,
    signCx: 246,
    verifyRight: 662,
    qrX: 676,
  },
  minimalista: {
    label: "Minimalista",
    hint: "Sem moldura, linhas finas no topo e na base",
    paper: "#ffffff",
    shapes: [
      { kind: "rect", x: 0, y: 0, w: W, h: 8, fill: "primary" },
      { kind: "rect", x: 0, y: 8, w: W, h: 3, fill: "accent" },
      { kind: "rect", x: 0, y: H - 8, w: W, h: 8, fill: "primary" },
    ],
    cx: W / 2,
    half: 340,
    signCx: 232,
    verifyRight: 690,
    qrX: 704,
  },
  faixa: {
    label: "Faixas",
    hint: "Faixas largas no topo e na base",
    paper: "#ffffff",
    shapes: [
      { kind: "rect", x: 0, y: 0, w: W, h: 40, fill: "primary" },
      { kind: "rect", x: 0, y: 40, w: W, h: 5, fill: "accent" },
      { kind: "rect", x: 0, y: H - 34, w: W, h: 34, fill: "primary" },
      { kind: "rect", x: 0, y: H - 39, w: W, h: 5, fill: "accent" },
      { kind: "path", d: `M${W - 220} 0H${W}V40H${W - 180}Z`, fill: "accent" },
      { kind: "path", d: `M0 ${H - 34}H200L170 ${H}H0Z`, fill: "accent" },
    ],
    cx: W / 2,
    half: 340,
    signCx: 232,
    verifyRight: 690,
    qrX: 704,
  },
};

export function paint(p: Paint, t: Pick<CertificateTheme, "primary" | "accent" | "ink">): string {
  return p === "primary" ? t.primary : p === "accent" ? t.accent : p === "ink" ? t.ink : p;
}
