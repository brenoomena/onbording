import QRCode from "qrcode";
import type { CSSProperties } from "react";
import {
  CERT_MODELS,
  LAYOUT,
  paint,
  PAGE,
  fillText,
  qrPath,
  scoreSegments,
  shortDate,
  titleScale,
  type CertificateData,
  type CertificateTheme,
  type Segment,
} from "@/lib/certificate";

/** Tamanho em pontos → unidade proporcional à largura do certificado. */
const u = (pt: number) => `${(pt / PAGE.w) * 100}cqw`;
/** Topo da caixa de texto para que a linha de base caia no `y` do PDF. */
const top = (y: number, size: number, lh = 1.2) => u(y - size * 0.78 - (size * (lh - 1)) / 2);

const SANS = "Helvetica, Arial, sans-serif";
const SERIF = "'Times New Roman', Times, Georgia, serif";

function Text({ segs, color, strongColor }: { segs: Segment[]; color: string; strongColor: string }) {
  return (
    <>
      {segs.map((s, i) =>
        s.strong ? (
          <strong key={i} style={{ color: strongColor, fontWeight: 700 }}>
            {s.text}
          </strong>
        ) : (
          <span key={i} style={{ color }}>
            {s.text}
          </span>
        ),
      )}
    </>
  );
}

function mix(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(255 - (255 - v) * alpha);
  return `rgb(${c((n >> 16) & 255)} ${c((n >> 8) & 255)} ${c(n & 255)})`;
}

/**
 * Certificado desenhado em HTML com as mesmas medidas do PDF (A4 deitado).
 * Ocupa a largura do elemento pai, mantendo a proporção.
 */
export function CertificateView({
  theme: t,
  data: d,
  logoUrl,
  signatureUrl,
  validationUrl,
  className,
}: {
  theme: CertificateTheme;
  data: CertificateData;
  logoUrl: string | null;
  signatureUrl: string | null;
  validationUrl: string;
  className?: string;
}) {
  const L = LAYOUT;
  const M = CERT_MODELS[t.model] ?? CERT_MODELS.classico;
  const cx = M.cx;
  const textW = Math.min(L.body.maxW, 2 * M.half - 20);
  const muted = mix(t.ink, 0.62);
  // Caixa centralizada na área de texto do modelo.
  const abs = (style: CSSProperties, half = M.half): CSSProperties => ({ position: "absolute", left: u(cx - half), width: u(2 * half), textAlign: "center", ...style });
  const score = scoreSegments(d, t);
  const qr = t.showQr ? QRCode.create(validationUrl, { errorCorrectionLevel: "M" }).modules : null;
  const qrX = M.qrX;
  const right = t.showQr ? M.verifyRight : qrX + L.verify.qr.size;
  const signCx = M.signCx;
  const ts = titleScale(t.title) * (M.half < 300 ? 0.85 : 1);

  return (
    <div className={className} style={{ containerType: "inline-size" }}>
      <div
        role="img"
        aria-label={`Certificado de ${d.person_name}: ${d.track_name}`}
        className="relative w-full overflow-hidden shadow-[0_10px_40px_-12px_rgba(15,23,42,0.35)]"
        style={{ aspectRatio: `${PAGE.w} / ${PAGE.h}`, fontFamily: SANS, color: t.ink, lineHeight: 1.2, background: M.paper }}
      >
        <svg aria-hidden viewBox={`0 0 ${PAGE.w} ${PAGE.h}`} className="absolute inset-0 h-full w-full">
          {M.shapes.map((sh, i) =>
            sh.kind === "rect" ? (
              <rect
                key={i}
                x={sh.x}
                y={sh.y}
                width={sh.w}
                height={sh.h}
                fill={sh.fill ? paint(sh.fill, t) : "none"}
                stroke={sh.stroke ? paint(sh.stroke, t) : undefined}
                strokeWidth={sh.sw}
              />
            ) : (
              <path key={i} d={sh.d} fill={paint(sh.fill, t)} />
            ),
          )}
          <line x1={cx - L.rule.w / 2} x2={cx + L.rule.w / 2} y1={L.rule.y} y2={L.rule.y} stroke={t.accent} strokeWidth={1} />
          {(t.signerName || signatureUrl) && (
            <line x1={signCx - L.sign.lineW / 2} x2={signCx + L.sign.lineW / 2} y1={L.sign.lineY} y2={L.sign.lineY} stroke={muted} strokeWidth={0.8} />
          )}
          {qr && (
            <g transform={`translate(${qrX} ${L.verify.qr.y}) scale(${L.verify.qr.size / qr.size})`}>
              <path d={qrPath(qr)} fill={t.primary} shapeRendering="crispEdges" />
            </g>
          )}
        </svg>

        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            style={{ position: "absolute", left: u(cx), top: u(L.logo.cy), transform: "translate(-50%, -50%)", maxWidth: u(t.logoHeight * 4), maxHeight: u(t.logoHeight), objectFit: "contain" }}
          />
        )}
        <p style={abs({ top: top(L.title.y, L.title.size * ts), fontSize: u(L.title.size * ts), letterSpacing: u(L.title.spacing * titleScale(t.title)), whiteSpace: "nowrap", fontWeight: 700, color: t.primary, textTransform: "uppercase" })}>{t.title}</p>
        {t.subtitle && (
          <p style={abs({ top: top(L.subtitle.y, L.subtitle.size), fontSize: u(L.subtitle.size), letterSpacing: u(L.subtitle.spacing), fontWeight: 700, color: t.accent, textTransform: "uppercase" })}>
            {t.subtitle}
          </p>
        )}
        {t.intro && <p style={abs({ top: top(L.intro.y, L.intro.size), fontSize: u(L.intro.size), color: muted })}>{t.intro}</p>}
        <p
          style={abs({
            top: top(L.name.y, L.name.size),
            fontSize: u(L.name.size),
            fontFamily: t.nameStyle === "serifada" ? SERIF : SANS,
            fontStyle: t.nameStyle === "serifada" ? "italic" : "normal",
            fontWeight: 700,
            color: t.primary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }, M.half - 10)}
        >
          {d.person_name}
        </p>
        <div style={abs({ top: top(L.body.y, L.body.size, L.body.line / L.body.size), fontSize: u(L.body.size), lineHeight: L.body.line / L.body.size }, textW / 2)}>
          <p>
            <Text segs={fillText(t.body, d, t)} color={t.ink} strongColor={t.primary} />
          </p>
          {score && (
            <p style={{ marginTop: u(4), fontSize: u(L.body.size - 1) }}>
              <Text segs={score} color={muted} strongColor={t.primary} />
            </p>
          )}
        </div>

        {signatureUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signatureUrl}
            alt=""
            style={{ position: "absolute", left: u(signCx), bottom: u(PAGE.h - L.sign.lineY + 3), transform: "translateX(-50%)", maxWidth: u(L.sign.img.maxW), maxHeight: u(L.sign.img.maxH), objectFit: "contain" }}
          />
        )}
        {t.signerName && (
          <p style={{ position: "absolute", left: u(signCx - 150), width: u(300), textAlign: "center", top: top(L.sign.lineY + 15, 11), fontSize: u(11), fontWeight: 700 }}>{t.signerName}</p>
        )}
        {t.signerRole && (
          <p style={{ position: "absolute", left: u(signCx - 150), width: u(300), textAlign: "center", top: top(L.sign.lineY + 28, 9.5), fontSize: u(9.5), color: muted }}>{t.signerRole}</p>
        )}

        {(
          [
            ["Código de validação", 8, 476, { fontWeight: 700, color: muted, textTransform: "uppercase" }],
            [d.code, 13, 493, { fontWeight: 700, color: t.primary, fontFamily: "'Courier New', Courier, monospace" }],
            [`Valide em ${validationUrl.replace(/^https?:\/\//, "")}`, 7.5, 508, { color: muted }],
            [`Emitido em ${shortDate(d.issued_at)}`, 7.5, 520, { color: muted }],
          ] as [string, number, number, CSSProperties][]
        ).map(([text, size, y, style]) => (
          <p key={y} style={{ position: "absolute", right: u(PAGE.w - right), top: top(y, size), fontSize: u(size), whiteSpace: "nowrap", textAlign: "right", ...style }}>
            {text}
          </p>
        ))}
      </div>
    </div>
  );
}
