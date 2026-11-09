/**
 * Corpo dos e-mails (HTML simples em tabelas, que funciona nos leitores de
 * e-mail, mais a versão em texto). Puro: recebe os dados da fila e devolve
 * assunto, HTML e texto. Todo valor vindo do banco é escapado.
 */

import { DEFAULT_EMAIL_THEME, type EmailTheme } from "@/lib/email-settings";

export interface EmailRow {
  kind: string;
  subject: string;
  data: Record<string, unknown>;
}

export interface EmailContext {
  siteUrl: string;
  appName: string;
  /** Cor da marca (usada quando o tema não escolhe a cor do botão). */
  brand: string;
  /** Logo já resolvida para o cabeçalho (absoluta, https) ou null. */
  logoUrl: string | null;
  /** Visual escolhido em Configurações › E-mails; sem ele, o padrão. */
  theme?: EmailTheme;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

/** Só links internos do sistema (começam com "/"). */
function link(ctx: EmailContext, path: unknown): string {
  const p = str(path);
  return ctx.siteUrl + (p.startsWith("/") && !p.startsWith("//") ? p : "/painel");
}

interface Block {
  heading: string;
  paragraphs: string[]; // já em HTML seguro
  text: string[];
  cta?: { label: string; href: string };
  table?: { html: string; text: string };
  footer?: string;
}

function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Cor da marca escurecida até o texto branco ficar legível (contraste 4,5:1). */
export function buttonColor(brand: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(brand)) return "#0a6f86";
  let [r, g, b] = [1, 3, 5].map((i) => parseInt(brand.slice(i, i + 2), 16));
  const hex = () => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  for (let i = 0; i < 30 && 1.05 / (lum(hex()) + 0.05) < 4.5; i++) [r, g, b] = [r * 0.92, g * 0.92, b * 0.92];
  return hex();
}

/** Texto legível sobre um fundo: branco ou quase preto. */
export function inkOn(bg: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(bg)) return "#ffffff";
  return 1.05 / (lum(bg) + 0.05) >= 4.5 ? "#ffffff" : "#0f172a";
}

/** Mistura a cor com branco (0 = cor, 1 = branco): tons suaves para bordas. */
function soft(hex: string, amount: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#e2e8f0";
  return "#" + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) + (255 - parseInt(hex.slice(i, i + 2), 16)) * amount).toString(16).padStart(2, "0")).join("");
}

function layout(ctx: EmailContext, b: Block): { html: string; text: string } {
  const t = ctx.theme ?? DEFAULT_EMAIL_THEME;
  const accent = t.accent || buttonColor(ctx.brand);
  const btnInk = inkOn(accent);
  const align = t.logoAlign === "centro" ? "center" : "left";
  const headerBg = t.layout === "faixa" ? t.header : t.layout === "minimalista" ? t.background : t.header;
  const headerInk = inkOn(headerBg) === "#ffffff" ? "#ffffff" : accent;
  const muted = soft(t.text, 0.42);
  const name = esc(t.senderName || ctx.appName);
  const logo = ctx.logoUrl
    ? `<img src="${esc(ctx.logoUrl)}" alt="${name}" height="${t.logoHeight}" style="display:${align === "center" ? "inline-block" : "block"};height:${t.logoHeight}px;max-width:260px;border:0">`
    : `<span style="font-size:18px;font-weight:700;color:${esc(headerInk)}">${name}</span>`;
  const button = b.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tr><td style="border-radius:8px;background:${esc(accent)}"><a href="${esc(b.cta.href)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:${btnInk};text-decoration:none;border-radius:8px">${esc(b.cta.label)}</a></td></tr></table>`
    : "";
  const custom = t.footer ? esc(t.footer).replace(/\n/g, "<br>") : "";
  const footer = [custom, b.footer ?? `Você recebeu este e-mail porque tem acesso ao ${name}.`].filter(Boolean).join("<br><br>");
  const signature = t.signature ? `<p style="margin:22px 0 0;font-size:15px;line-height:1.55">${esc(t.signature)}</p>` : "";
  const card = t.layout === "minimalista" ? "" : `background:${esc(t.card)};border-radius:14px;border:1px solid ${soft(t.text, 0.85)};`;
  const headerRow =
    t.layout === "faixa"
      ? `<tr><td align="${align}" style="padding:24px 28px;background:${esc(t.header)};border-radius:14px 14px 0 0">${logo}</td></tr>`
      : t.layout === "minimalista"
        ? `<tr><td align="${align}" style="padding:8px 4px 18px;border-bottom:2px solid ${esc(accent)}">${logo}</td></tr>`
        : `<tr><td align="${align}" style="padding:22px 28px;background:${esc(t.header)};border-radius:14px 14px 0 0;border-bottom:3px solid ${esc(accent)}">${logo}</td></tr>`;
  const pad = t.layout === "minimalista" ? "24px 4px" : "28px";
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(b.heading)}</title></head>
<body style="margin:0;padding:0;background:${esc(t.background)};font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:${esc(t.text)}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${esc(t.background)};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;${card}">
${headerRow}
<tr><td style="padding:${pad};color:${esc(t.text)}">
<h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:${esc(t.text)}">${esc(b.heading)}</h1>
${b.paragraphs.filter(Boolean).map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${p}</p>`).join("")}
${b.table?.html ?? ""}
${button}
${b.cta ? `<p style="margin:12px 0 0;font-size:12px;color:${muted}">Se o botão não abrir, copie o endereço: <a href="${esc(b.cta.href)}" style="color:${muted}">${esc(b.cta.href)}</a></p>` : ""}
${signature}
</td></tr>
<tr><td style="padding:${t.layout === "minimalista" ? "16px 4px" : "16px 28px 22px"};border-top:1px solid ${soft(t.text, 0.88)};font-size:12px;line-height:1.5;color:${muted}">${footer}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    b.heading,
    "",
    ...b.text.filter(Boolean),
    ...(b.table ? ["", b.table.text] : []),
    ...(b.cta ? ["", `${b.cta.label}: ${b.cta.href}`] : []),
    ...(t.signature ? ["", t.signature] : []),
    "",
    "—",
    ...(t.footer ? [t.footer] : []),
    t.senderName || ctx.appName,
  ].join("\n");
  return { html, text };
}

const prefsFooter = (ctx: EmailContext) =>
  `Você recebeu este e-mail do ${esc(ctx.appName)}. Para escolher quais lembretes receber, acesse <a href="${esc(ctx.siteUrl)}/meu-perfil#emails" style="color:#475569">Meu perfil › E-mails</a>.`;

export function renderEmail(row: EmailRow, ctx: EmailContext): RenderedEmail {
  const d = row.data ?? {};
  const name = str(d.name);
  const greeting = (ctx.theme ?? DEFAULT_EMAIL_THEME).greeting;
  const helloText = greeting ? (name ? greeting.replace(/\{nome\}/g, name) : greeting.replace(/,?\s*\{nome\}/g, "")) : "";
  const hello = esc(helloText);
  let block: Block;

  switch (row.kind) {
    case "matricula": {
      const track = str(d.title).replace(/^Nova trilha:\s*/, "");
      block = {
        heading: `Nova trilha para você: ${track}`,
        paragraphs: [hello, `Você foi matriculado(a) na trilha <strong>${esc(track)}</strong>.`, esc(str(d.body))],
        text: [helloText, `Você foi matriculado(a) na trilha ${track}.`, str(d.body)],
        cta: { label: "Começar a trilha", href: link(ctx, d.link) },
      };
      break;
    }
    case "prazo_proximo": {
      const days = num(d.days);
      const when = days === 0 ? "vence <strong>hoje</strong>" : `vence em <strong>${days} ${days === 1 ? "dia" : "dias"}</strong> (${esc(str(d.due))})`;
      const whenText = days === 0 ? "vence hoje" : `vence em ${days} ${days === 1 ? "dia" : "dias"} (${str(d.due)})`;
      block = {
        heading: days === 0 ? `Vence hoje: ${str(d.track)}` : `Prazo chegando: ${str(d.track)}`,
        paragraphs: [hello, `A trilha <strong>${esc(str(d.track))}</strong> ${when}. Seu progresso está em <strong>${num(d.progress)}%</strong>.`],
        text: [helloText, `A trilha ${str(d.track)} ${whenText}. Seu progresso está em ${num(d.progress)}%.`],
        cta: { label: "Continuar a trilha", href: link(ctx, d.link) },
        footer: prefsFooter(ctx),
      };
      break;
    }
    case "prazo_vencido": {
      const mandatory = d.mandatory === true;
      block = {
        heading: `Prazo vencido: ${str(d.track)}`,
        paragraphs: [
          hello,
          `O prazo da trilha <strong>${esc(str(d.track))}</strong> era ${esc(str(d.due))} e ela ainda não foi concluída (progresso: <strong>${num(d.progress)}%</strong>).`,
          mandatory ? "Esta trilha é obrigatória. Conclua assim que puder." : "Conclua assim que puder.",
        ],
        text: [helloText, `O prazo da trilha ${str(d.track)} era ${str(d.due)} e ela ainda não foi concluída (progresso: ${num(d.progress)}%).`, mandatory ? "Esta trilha é obrigatória. Conclua assim que puder." : "Conclua assim que puder."],
        cta: { label: "Concluir a trilha", href: link(ctx, d.link) },
        footer: mandatory ? undefined : prefsFooter(ctx),
      };
      break;
    }
    case "comunicado": {
      block = {
        heading: str(d.title) || row.subject,
        paragraphs: [hello, "Há um comunicado importante para você:", `<em>${esc(str(d.body))}</em>`],
        text: [helloText, "Há um comunicado importante para você:", str(d.body)],
        cta: { label: "Ler o comunicado", href: link(ctx, d.link) },
        footer: prefsFooter(ctx),
      };
      break;
    }
    case "resumo_semanal": {
      const rows = (Array.isArray(d.rows) ? d.rows : []) as Record<string, unknown>[];
      const shown = rows.slice(0, 40);
      const status = (r: Record<string, unknown>) => (r.done === true ? "Concluída" : r.late === true ? "Em atraso" : num(r.progress) > 0 ? "Em andamento" : "Não iniciada");
      const color = (r: Record<string, unknown>) => (r.done === true ? "#15803d" : r.late === true ? "#b91c1c" : "#334155");
      const th = (t: string, align = "left") => `<th align="${align}" style="padding:8px 10px;font-size:12px;font-weight:600;color:#64748b;border-bottom:1px solid #e2e8f0">${t}</th>`;
      const td = (v: string, extra = "") => `<td style="padding:8px 10px;font-size:13px;border-bottom:1px solid #f1f5f9;${extra}">${v}</td>`;
      const html =
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;border-collapse:collapse">` +
        `<tr>${th("Pessoa")}${th("Trilha")}${th("Progresso", "right")}${th("Prazo")}${th("Situação")}</tr>` +
        shown
          .map(
            (r) =>
              `<tr>${td(esc(str(r.person)))}${td(esc(str(r.track)))}${td(`${num(r.progress)}%`, "text-align:right")}${td(esc(str(r.due) || "—"))}${td(status(r), `color:${color(r)};font-weight:600`)}</tr>`,
          )
          .join("") +
        `</table>` +
        (rows.length > shown.length ? `<p style="margin:6px 0 0;font-size:12px;color:#64748b">E mais ${rows.length - shown.length} no Acompanhamento.</p>` : "");
      const text = shown.map((r) => `- ${str(r.person)} · ${str(r.track)} · ${num(r.progress)}% · prazo ${str(r.due) || "—"} · ${status(r)}`).join("\n");
      block = {
        heading: "Resumo semanal da sua equipe",
        paragraphs: [
          hello,
          `Semana de ${esc(str(d.week))}: <strong style="color:#b91c1c">${num(d.late)} em atraso</strong>, <strong>${num(d.open)} em aberto</strong> e <strong style="color:#15803d">${num(d.done)} concluída(s)</strong> nos últimos 7 dias.`,
        ],
        text: [helloText, `Semana de ${str(d.week)}: ${num(d.late)} em atraso, ${num(d.open)} em aberto e ${num(d.done)} concluída(s) nos últimos 7 dias.`],
        table: { html, text },
        cta: { label: "Abrir o Acompanhamento", href: link(ctx, d.link) },
        footer: prefsFooter(ctx),
      };
      break;
    }
    default: {
      block = {
        heading: "E-mail de teste",
        paragraphs: [hello, "Se você recebeu esta mensagem, o envio de e-mails do Onboarding está funcionando."],
        text: [helloText, "Se você recebeu esta mensagem, o envio de e-mails do Onboarding está funcionando."],
        cta: { label: "Abrir as configurações de e-mail", href: link(ctx, d.link) },
      };
    }
  }

  const { html, text } = layout(ctx, block);
  return { subject: row.subject, html, text };
}

/** Fundo onde a logo fica, conforme o layout. */
export function headerBackground(t: EmailTheme): string {
  return t.layout === "minimalista" ? t.background : t.header;
}

/**
 * Logo do cabeçalho: a da Marca (versão para fundo claro ou escuro, conforme o
 * cabeçalho), a enviada só para os e-mails, ou nenhuma. Só endereços https.
 */
export function emailLogo(t: EmailTheme, brand: { onLight: string | null; onDark: string | null }, storageBase: string): string | null {
  const url =
    t.logoSource === "nenhuma"
      ? null
      : t.logoSource === "propria" && t.logoPath
        ? `${storageBase.replace(/\/$/, "")}/${t.logoPath}`
        : inkOn(headerBackground(t)) === "#ffffff"
          ? (brand.onDark ?? brand.onLight)
          : (brand.onLight ?? brand.onDark);
  return url && /^https:\/\//.test(url) ? url : null;
}
