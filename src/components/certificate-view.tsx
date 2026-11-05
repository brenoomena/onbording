import QRCode from "qrcode";
import type { CSSProperties } from "react";
import {
  LAYOUT,
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
  const muted = mix(t.ink, 0.62);
  const abs = (style: CSSProperties): CSSProperties => ({ position: "absolute", left: 0, right: 0, textAlign: "center", ...style });
  const score = scoreSegments(d, t);
  const qr = t.showQr ? QRCode.create(validationUrl, { errorCorrectionLevel: "M" }).modules : null;
  const right = t.showQr ? L.verify.right : L.verify.qr.x + L.verify.qr.size;
  const c = L.corner;

  return (
    <div className={className} style={{ containerType: "inline-size" }}>
      <div
        role="img"
        aria-label={`Certificado de ${d.person_name}: ${d.track_name}`}
        className="relative w-full overflow-hidden bg-white shadow-[0_10px_40px_-12px_rgba(15,23,42,0.35)]"
        style={{ aspectRatio: `${PAGE.w} / ${PAGE.h}`, fontFamily: SANS, color: t.ink, lineHeight: 1.2 }}
      >
        <svg aria-hidden viewBox={`0 0 ${PAGE.w} ${PAGE.h}`} className="absolute inset-0 h-full w-full">
          <rect x={L.frameOuter} y={L.frameOuter} width={PAGE.w - 2 * L.frameOuter} height={PAGE.h - 2 * L.frameOuter} fill="none" stroke={t.primary} strokeWidth={2.2} />
          <rect x={L.frameInner} y={L.frameInner} width={PAGE.w - 2 * L.frameInner} height={PAGE.h - 2 * L.frameInner} fill="none" stroke={t.accent} strokeWidth={0.7} />
          <path d={`M${PAGE.w - c} 0H${PAGE.w}V${c}Z`} fill={t.primary} />
          <path d={`M${PAGE.w - c * 0.62} 0H${PAGE.w}V${c * 0.62}Z`} fill={t.accent} />
          <path d={`M0 ${PAGE.h - c}L${c} ${PAGE.h}H0Z`} fill={t.primary} />
          <path d={`M0 ${PAGE.h - c * 0.62}L${c * 0.62} ${PAGE.h}H0Z`} fill={t.accent} />
          <line x1={(PAGE.w - L.rule.w) / 2} x2={(PAGE.w + L.rule.w) / 2} y1={L.rule.y} y2={L.rule.y} stroke={t.accent} strokeWidth={1} />
          {(t.signerName || signatureUrl) && (
            <line x1={L.sign.cx - L.sign.lineW / 2} x2={L.sign.cx + L.sign.lineW / 2} y1={L.sign.lineY} y2={L.sign.lineY} stroke={muted} strokeWidth={0.8} />
          )}
          {qr && (
            <g transform={`translate(${L.verify.qr.x} ${L.verify.qr.y}) scale(${L.verify.qr.size / qr.size})`}>
              <path d={qrPath(qr)} fill={t.primary} shapeRendering="crispEdges" />
            </g>
          )}
        </svg>

        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            style={{ position: "absolute", left: "50%", top: u(L.logo.y), transform: "translateX(-50%)", maxWidth: u(L.logo.maxW), maxHeight: u(L.logo.maxH), height: u(L.logo.maxH), objectFit: "contain" }}
          />
        )}
        <p style={abs({ top: top(L.title.y, L.title.size * titleScale(t.title)), fontSize: u(L.title.size * titleScale(t.title)), letterSpacing: u(L.title.spacing * titleScale(t.title)), whiteSpace: "nowrap", fontWeight: 700, color: t.primary, textTransform: "uppercase" })}>{t.title}</p>
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
            padding: `0 ${u(90)}`,
          })}
        >
          {d.person_name}
        </p>
        <div style={abs({ top: top(L.body.y, L.body.size, L.body.line / L.body.size), left: u((PAGE.w - L.body.maxW) / 2), right: u((PAGE.w - L.body.maxW) / 2), fontSize: u(L.body.size), lineHeight: L.body.line / L.body.size })}>
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
            style={{ position: "absolute", left: u(L.sign.cx), bottom: u(PAGE.h - L.sign.lineY + 3), transform: "translateX(-50%)", maxWidth: u(L.sign.img.maxW), maxHeight: u(L.sign.img.maxH), objectFit: "contain" }}
          />
        )}
        {t.signerName && (
          <p style={{ position: "absolute", left: u(L.sign.cx - 150), width: u(300), textAlign: "center", top: top(L.sign.lineY + 15, 11), fontSize: u(11), fontWeight: 700 }}>{t.signerName}</p>
        )}
        {t.signerRole && (
          <p style={{ position: "absolute", left: u(L.sign.cx - 150), width: u(300), textAlign: "center", top: top(L.sign.lineY + 28, 9.5), fontSize: u(9.5), color: muted }}>{t.signerRole}</p>
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
