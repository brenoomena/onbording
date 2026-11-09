import { describe, expect, it } from "vitest";
import { DEFAULT_EMAIL_SETTINGS, sanitizeEmailSettings, toDb } from "@/lib/email-settings";
import { buttonColor, renderEmail, type EmailContext } from "@/lib/email/templates";

const ctx: EmailContext = { siteUrl: "https://onbording.exemplo.com", appName: "Onboarding Implantta", brand: "#14afcc", logoUrl: null };

describe("configuração de e-mails", () => {
  it("padrão: tudo ligado, lembrete 3 dias antes e no dia", () => {
    expect(sanitizeEmailSettings(undefined)).toEqual(DEFAULT_EMAIL_SETTINGS);
  });
  it("aceita só os dias oferecidos e tipos booleanos", () => {
    const s = sanitizeEmailSettings({ kinds: { resumo: false, matricula: "não" }, reminder_days: [0, 3, 3, 99, "7", -1] });
    expect(s.kinds.resumo).toBe(false);
    expect(s.kinds.matricula).toBe(true);
    expect(s.reminderDays).toEqual([7, 3, 0]);
    expect(toDb(s).reminder_days).toEqual([7, 3, 0]);
  });
});

describe("modelos de e-mail", () => {
  it("matrícula: saudação pelo primeiro nome e link absoluto do sistema", () => {
    const m = renderEmail({ kind: "matricula", subject: "Nova trilha: Vendas", data: { name: "Vera", title: "Nova trilha: Vendas", body: "Prazo para concluir: 12/11/2026.", link: "/minhas-trilhas/abc" } }, ctx);
    expect(m.subject).toBe("Nova trilha: Vendas");
    expect(m.html).toContain("Olá, Vera!");
    expect(m.html).toContain('href="https://onbording.exemplo.com/minhas-trilhas/abc"');
    expect(m.text).toContain("Começar a trilha: https://onbording.exemplo.com/minhas-trilhas/abc");
  });

  it("escapa o que vem do banco e não aceita link externo", () => {
    const m = renderEmail({ kind: "comunicado", subject: "x", data: { title: "<script>alert(1)</script>", body: 'a "b" <img src=x>', link: "https://malicioso.com" } }, ctx);
    expect(m.html).not.toContain("<script>");
    expect(m.html).not.toContain("<img src=x>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.html).not.toContain("malicioso.com");
    expect(m.html).toContain("https://onbording.exemplo.com/painel");
    const m2 = renderEmail({ kind: "comunicado", subject: "x", data: { link: "//malicioso.com/x" } }, ctx);
    expect(m2.html).not.toContain("malicioso.com");
  });

  it("prazo: no dia e com dias restantes", () => {
    expect(renderEmail({ kind: "prazo_proximo", subject: "s", data: { track: "T", days: 0, progress: 40 } }, ctx).text).toContain("vence hoje");
    expect(renderEmail({ kind: "prazo_proximo", subject: "s", data: { track: "T", days: 3, due: "12/11/2026", progress: 40 } }, ctx).text).toContain("vence em 3 dias (12/11/2026)");
  });

  it("atraso de trilha obrigatória não oferece desligar", () => {
    const ob = renderEmail({ kind: "prazo_vencido", subject: "s", data: { track: "T", due: "01/11/2026", mandatory: true } }, ctx);
    expect(ob.html).toContain("obrigatória");
    expect(ob.html).not.toContain("meu-perfil#emails");
    expect(renderEmail({ kind: "prazo_vencido", subject: "s", data: { track: "T", mandatory: false } }, ctx).html).toContain("meu-perfil#emails");
  });

  it("resumo semanal lista a equipe com a situação", () => {
    const m = renderEmail(
      {
        kind: "resumo_semanal",
        subject: "Resumo semanal da sua equipe",
        data: { week: "16/11/2026", late: 1, open: 2, done: 1, rows: [{ person: "Vera", track: "Vendas", progress: 30, due: "12/11/2026", late: true }, { person: "Carlos", track: "Financeiro", progress: 100, done: true }] },
      },
      ctx,
    );
    expect(m.html).toContain("Em atraso");
    expect(m.html).toContain("Concluída");
    expect(m.text).toContain("- Vera · Vendas · 30% · prazo 12/11/2026 · Em atraso");
  });
});

describe("cor do botão", () => {
  it("escurece cores claras até o branco ficar legível", () => {
    const c = buttonColor("#14afcc");
    expect(c).not.toBe("#14afcc");
    const l = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    expect(1.05 / (l(c) + 0.05)).toBeGreaterThanOrEqual(4.5);
    expect(buttonColor("#0f172a")).toBe("#0f172a");
  });
});

import { DEFAULT_EMAIL_THEME, fromHeader, sanitizeEmailTheme } from "@/lib/email-settings";
import { emailLogo, inkOn } from "@/lib/email/templates";

describe("visual dos e-mails", () => {
  it("nome do remetente aparece junto do endereço", () => {
    expect(fromHeader("onboarding@implanttasistemas.com.br", "Onboarding Implantta")).toBe('"Onboarding Implantta" <onboarding@implanttasistemas.com.br>');
    expect(fromHeader("Outro <onboarding@implanttasistemas.com.br>", "Onboarding Implantta")).toBe('"Onboarding Implantta" <onboarding@implanttasistemas.com.br>');
    expect(fromHeader(" onboarding@x.com \n", "")).toBe("onboarding@x.com");
    // Aspas, < > e quebras não escapam do nome.
    expect(fromHeader("a@x.com", 'Ev"il <b@y.com>\r\nBcc: c@z.com')).toBe('"Ev il b@y.com Bcc: c@z.com" <a@x.com>');
  });

  it("valores inválidos voltam ao padrão", () => {
    const t = sanitizeEmailTheme({ layout: "outro", header: "red", accent: "", logoHeight: 500, logoPath: "../x.png", senderName: "   ", footer: "<b>oi</b>" });
    expect(t.layout).toBe("cartao");
    expect(t.header).toBe(DEFAULT_EMAIL_THEME.header);
    expect(t.accent).toBe("");
    expect(t.logoHeight).toBe(80);
    expect(t.logoPath).toBeNull();
    expect(t.senderName).toBe("Onboarding Implantta");
    expect(t.footer).toBe("boi/b");
  });

  it("saudação, assinatura, rodapé e cores entram no e-mail", () => {
    const theme = { ...DEFAULT_EMAIL_THEME, layout: "faixa" as const, header: "#0f2a4a", accent: "#ffcc00", greeting: "Oi {nome}, tudo bem?", signature: "Time de RH", footer: "Dúvidas: rh@x.com" };
    const m = renderEmail({ kind: "matricula", subject: "s", data: { name: "Vera", title: "Nova trilha: T", link: "/x" } }, { ...ctx, theme, logoUrl: null });
    expect(m.html).toContain("Oi Vera, tudo bem?");
    expect(m.html).toContain("Time de RH");
    expect(m.html).toContain("Dúvidas: rh@x.com");
    expect(m.html).toContain("background:#0f2a4a");
    expect(m.html).toContain("background:#ffcc00");
    expect(m.html).toContain("color:#0f172a;text-decoration:none"); // texto escuro no botão amarelo
    expect(m.text).toContain("Time de RH");
    const semNome = renderEmail({ kind: "teste", subject: "s", data: {} }, { ...ctx, theme: { ...theme, greeting: "Olá, {nome}!" } });
    expect(semNome.html).toContain(">Olá!<");
  });

  it("logo: versão da marca conforme o fundo, própria ou nenhuma", () => {
    const brand = { onLight: "https://x/logo-escura.png", onDark: "https://x/logo-branca.png" };
    expect(emailLogo({ ...DEFAULT_EMAIL_THEME, header: "#ffffff" }, brand, "https://s")).toBe(brand.onLight);
    expect(emailLogo({ ...DEFAULT_EMAIL_THEME, layout: "faixa", header: "#0f2a4a" }, brand, "https://s")).toBe(brand.onDark);
    expect(emailLogo({ ...DEFAULT_EMAIL_THEME, logoSource: "propria", logoPath: "logo/a.png" }, brand, "https://s/")).toBe("https://s/logo/a.png");
    expect(emailLogo({ ...DEFAULT_EMAIL_THEME, logoSource: "nenhuma" }, brand, "https://s")).toBeNull();
    expect(inkOn("#ffffff")).toBe("#0f172a");
  });
});

describe("atraso na equipe", () => {
  it("conta ao supervisor quem atrasou e leva ao progresso da pessoa", () => {
    const m = renderEmail({ kind: "equipe_atraso", subject: "Atraso na equipe: Vera", data: { name: "Sérgio", person: "Vera Vendedora", track: "Vendas", due: "12/11/2026", progress: 40, mandatory: true, link: "/colaboradores/abc" } }, ctx);
    expect(m.text).toContain("A trilha Vendas de Vera Vendedora venceu em 12/11/2026");
    expect(m.html).toContain('href="https://onbording.exemplo.com/colaboradores/abc"');
    expect(m.html).toContain("obrigatória");
  });
});
