import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import {
  LAYOUT,
  PAGE,
  fillText,
  scoreSegments,
  shortDate,
  titleScale,
  type CertificateData,
  type CertificateTheme,
  type Segment,
} from "@/lib/certificate";

function color(hex: string, alpha = 1) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => 1 - (1 - v / 255) * alpha; // mistura com o branco
  return rgb(c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255));
}

/** Converte qualquer imagem (inclusive WebP) para PNG, que o PDF aceita. */
async function toPng(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const sharp = (await import("sharp")).default;
    return new Uint8Array(await sharp(bytes).png().toBuffer());
  } catch {
    return null;
  }
}

export async function fetchImage(url: string | null): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await toPng(new Uint8Array(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

/** Troca caracteres que a fonte do PDF não tem (ex.: emoji) por equivalentes simples. */
function safe(font: PDFFont, text: string): string {
  const set = new Set(font.getCharacterSet());
  return [...text.normalize("NFC")]
    .map((ch) => {
      if (set.has(ch.codePointAt(0)!)) return ch;
      const plain = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      return plain && [...plain].every((c) => set.has(c.codePointAt(0)!)) ? plain : ch === "’" ? "'" : "";
    })
    .join("");
}

function fit(img: PDFImage, maxW: number, maxH: number) {
  const s = Math.min(maxW / img.width, maxH / img.height, 1);
  return { w: img.width * s, h: img.height * s };
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  name: PDFFont;
  mono: PDFFont;
}

function centered(page: PDFPage, font: PDFFont, text: string, y: number, size: number, c: ReturnType<typeof rgb>, spacing = 0) {
  const s = safe(font, text);
  if (!spacing) {
    const w = font.widthOfTextAtSize(s, size);
    page.drawText(s, { x: (PAGE.w - w) / 2, y: PAGE.h - y, size, font, color: c });
    return;
  }
  // Letras espaçadas: desenha uma a uma.
  const chars = [...s];
  const total = chars.reduce((acc, ch) => acc + font.widthOfTextAtSize(ch, size), 0) + spacing * (chars.length - 1);
  let x = (PAGE.w - total) / 2;
  for (const ch of chars) {
    page.drawText(ch, { x, y: PAGE.h - y, size, font, color: c });
    x += font.widthOfTextAtSize(ch, size) + spacing;
  }
}

/** Parágrafo centralizado com trechos em negrito; devolve o y depois da última linha. */
function paragraph(page: PDFPage, fonts: Fonts, segs: Segment[], y: number, size: number, lh: number, maxW: number, ink: ReturnType<typeof rgb>, strongColor: ReturnType<typeof rgb>): number {
  type Word = { text: string; strong: boolean; w: number; space: number };
  const words: Word[] = [];
  for (const seg of segs) {
    const font = seg.strong ? fonts.bold : fonts.regular;
    const parts = safe(font, seg.text).split(/(\s+)/);
    for (const p of parts) {
      if (!p) continue;
      if (/^\s+$/.test(p)) {
        if (words.length) words[words.length - 1].space = fonts.regular.widthOfTextAtSize(" ", size);
        continue;
      }
      words.push({ text: p, strong: seg.strong, w: font.widthOfTextAtSize(p, size), space: 0 });
    }
  }
  const lines: Word[][] = [];
  let cur: Word[] = [];
  let width = 0;
  for (const w of words) {
    const prevSpace = cur.length ? cur[cur.length - 1].space : 0;
    if (cur.length && width + prevSpace + w.w > maxW) {
      lines.push(cur);
      cur = [];
      width = 0;
    }
    width += (cur.length ? cur[cur.length - 1].space : 0) + w.w;
    cur.push(w);
  }
  if (cur.length) lines.push(cur);
  for (const line of lines) {
    const lw = line.reduce((acc, w, i) => acc + w.w + (i < line.length - 1 ? w.space : 0), 0);
    let x = (PAGE.w - lw) / 2;
    for (const w of line) {
      page.drawText(w.text, { x, y: PAGE.h - y, size, font: w.strong ? fonts.bold : fonts.regular, color: w.strong ? strongColor : ink });
      x += w.w + w.space;
    }
    y += lh;
  }
  return y;
}

/** Gera o PDF (A4 deitado) de um certificado. */
export async function certificatePdf(opts: {
  theme: CertificateTheme;
  data: CertificateData;
  logo: Uint8Array | null;
  signature: Uint8Array | null;
  validationUrl: string;
}): Promise<Uint8Array> {
  const { theme: t, data: d } = opts;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificado · ${d.track_name}`);
  pdf.setAuthor("Onboarding Implantta");
  pdf.setSubject(`${d.person_name} · ${d.track_name}`);
  pdf.setCreator("Onboarding Implantta");
  const page = pdf.addPage([PAGE.w, PAGE.h]);
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    name: await pdf.embedFont(t.nameStyle === "serifada" ? StandardFonts.TimesRomanBoldItalic : StandardFonts.HelveticaBold),
    mono: await pdf.embedFont(StandardFonts.CourierBold),
  };
  const primary = color(t.primary);
  const accent = color(t.accent);
  const ink = color(t.ink);
  const muted = color(t.ink, 0.62);
  const L = LAYOUT;

  // Molduras.
  const o = L.frameOuter;
  const i = L.frameInner;
  page.drawRectangle({ x: o, y: o, width: PAGE.w - 2 * o, height: PAGE.h - 2 * o, borderColor: primary, borderWidth: 2.2 });
  page.drawRectangle({ x: i, y: i, width: PAGE.w - 2 * i, height: PAGE.h - 2 * i, borderColor: accent, borderWidth: 0.7 });

  // Cantos decorativos (superior direito e inferior esquerdo).
  const c = L.corner;
  page.drawSvgPath(`M ${PAGE.w - c} 0 L ${PAGE.w} 0 L ${PAGE.w} ${c} Z`, { x: 0, y: PAGE.h, color: primary });
  page.drawSvgPath(`M ${PAGE.w - c * 0.62} 0 L ${PAGE.w} 0 L ${PAGE.w} ${c * 0.62} Z`, { x: 0, y: PAGE.h, color: accent });
  page.drawSvgPath(`M 0 ${PAGE.h - c} L ${c} ${PAGE.h} L 0 ${PAGE.h} Z`, { x: 0, y: PAGE.h, color: primary });
  page.drawSvgPath(`M 0 ${PAGE.h - c * 0.62} L ${c * 0.62} ${PAGE.h} L 0 ${PAGE.h} Z`, { x: 0, y: PAGE.h, color: accent });
  if (opts.logo) {
    try {
      const img = await pdf.embedPng(opts.logo);
      const s = fit(img, L.logo.maxW, L.logo.maxH);
      page.drawImage(img, { x: (PAGE.w - s.w) / 2, y: PAGE.h - L.logo.y - s.h + (L.logo.maxH - s.h) / 2, width: s.w, height: s.h });
    } catch {
      /* logo inválida: segue sem ela */
    }
  }

  const ts = titleScale(t.title);
  centered(page, fonts.bold, t.title.toUpperCase(), L.title.y, L.title.size * ts, primary, L.title.spacing * ts);
  if (t.subtitle) centered(page, fonts.bold, t.subtitle.toUpperCase(), L.subtitle.y, L.subtitle.size, accent, L.subtitle.spacing);
  if (t.intro) centered(page, fonts.regular, t.intro, L.intro.y, L.intro.size, muted);
  // Nome: reduz até caber.
  let nameSize = L.name.size;
  const name = safe(fonts.name, d.person_name);
  while (nameSize > 18 && fonts.name.widthOfTextAtSize(name, nameSize) > 640) nameSize -= 1;
  centered(page, fonts.name, name, L.name.y, nameSize, primary);
  page.drawLine({ start: { x: (PAGE.w - L.rule.w) / 2, y: PAGE.h - L.rule.y }, end: { x: (PAGE.w + L.rule.w) / 2, y: PAGE.h - L.rule.y }, thickness: 1, color: accent });

  let y = paragraph(page, fonts, fillText(t.body, d, t), L.body.y, L.body.size, L.body.line, L.body.maxW, ink, primary);
  const score = scoreSegments(d, t);
  if (score) paragraph(page, fonts, score, y + 4, L.body.size - 1, L.body.line, L.body.maxW, muted, primary);

  // Assinatura.
  const sg = L.sign;
  if (opts.signature) {
    try {
      const img = await pdf.embedPng(opts.signature);
      const s = fit(img, sg.img.maxW, sg.img.maxH);
      page.drawImage(img, { x: sg.cx - s.w / 2, y: PAGE.h - sg.lineY + 3, width: s.w, height: s.h });
    } catch {
      /* sem assinatura */
    }
  }
  if (t.signerName || opts.signature) {
    page.drawLine({ start: { x: sg.cx - sg.lineW / 2, y: PAGE.h - sg.lineY }, end: { x: sg.cx + sg.lineW / 2, y: PAGE.h - sg.lineY }, thickness: 0.8, color: muted });
    const draw = (text: string, yy: number, size: number, font: PDFFont, col: ReturnType<typeof rgb>) => {
      const s2 = safe(font, text);
      page.drawText(s2, { x: sg.cx - font.widthOfTextAtSize(s2, size) / 2, y: PAGE.h - yy, size, font, color: col });
    };
    if (t.signerName) draw(t.signerName, sg.lineY + 15, 11, fonts.bold, ink);
    if (t.signerRole) draw(t.signerRole, sg.lineY + 28, 9.5, fonts.regular, muted);
  }

  // Validação.
  const v = L.verify;
  const right = t.showQr ? v.right : v.qr.x + v.qr.size;
  const lines: [string, number, PDFFont, ReturnType<typeof rgb>, number][] = [
    ["CÓDIGO DE VALIDAÇÃO", 8, fonts.bold, muted, 476],
    [d.code, 13, fonts.mono, primary, 493],
    [`Valide em ${opts.validationUrl.replace(/^https?:\/\//, "")}`, 7.5, fonts.regular, muted, 508],
    [`Emitido em ${shortDate(d.issued_at)}`, 7.5, fonts.regular, muted, 520],
  ];
  for (const [text, size, font, col, yy] of lines) {
    const s2 = safe(font, text);
    page.drawText(s2, { x: right - font.widthOfTextAtSize(s2, size), y: PAGE.h - yy, size, font, color: col });
  }
  if (t.showQr) {
    const qr = QRCode.create(opts.validationUrl, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    const cell = v.qr.size / n;
    for (let r = 0; r < n; r++) {
      for (let col = 0; col < n; col++) {
        if (qr.modules.get(r, col)) {
          page.drawRectangle({ x: v.qr.x + col * cell, y: PAGE.h - v.qr.y - (r + 1) * cell, width: cell + 0.05, height: cell + 0.05, color: primary });
        }
      }
    }
  }

  return pdf.save();
}
