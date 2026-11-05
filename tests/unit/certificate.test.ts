import { describe, expect, it } from "vitest";
import { DEFAULT_CERTIFICATE, SAMPLE_CERTIFICATE, diffCertificate, fillText, formatHours, formatScore, longDate, sanitizeCertificate, titleScale } from "@/lib/certificate";

describe("certificado", () => {
  it("preenche os marcadores e marca os dados em negrito", () => {
    const segs = fillText(DEFAULT_CERTIFICATE.body, SAMPLE_CERTIFICATE, DEFAULT_CERTIFICATE);
    expect(segs.map((s) => s.text).join("")).toBe("concluiu a trilha Onboarding Comercial, com carga horária de 12 horas, em 5 de novembro de 2026.");
    expect(segs.filter((s) => s.strong).map((s) => s.text)).toEqual(["Onboarding Comercial", "12 horas", "5 de novembro de 2026"]);
  });

  it("sem carga horária, tira o trecho da frase", () => {
    const segs = fillText(DEFAULT_CERTIFICATE.body, { ...SAMPLE_CERTIFICATE, hours: null }, DEFAULT_CERTIFICATE);
    expect(segs.map((s) => s.text).join("")).toBe("concluiu a trilha Onboarding Comercial em 5 de novembro de 2026.".replace(" em", ", em"));
  });

  it("formata horas, nota e data em português", () => {
    expect(formatHours(12)).toBe("12 horas");
    expect(formatHours(1)).toBe("1 hora");
    expect(formatHours(1.5)).toBe("1h30");
    expect(formatHours(0.5)).toBe("30 minutos");
    expect(formatHours(null)).toBeNull();
    expect(formatScore(92.5)).toBe("92,5%");
    expect(formatScore(100)).toBe("100%");
    // 00:30 UTC ainda é dia 4 em Brasília.
    expect(longDate("2026-11-05T00:30:00Z")).toBe("4 de novembro de 2026");
  });

  it("valida o modelo e guarda só o que muda", () => {
    expect(sanitizeCertificate({ primary: "azul", showQr: "sim", signaturePath: "../x.png", nameStyle: "sem_serifa", title: "  Certificado  " })).toEqual({ nameStyle: "sem_serifa", title: "Certificado" });
    expect(diffCertificate({ ...DEFAULT_CERTIFICATE, showQr: false })).toEqual({ showQr: false });
  });

  it("título longo diminui", () => {
    expect(titleScale("Certificado")).toBe(1);
    expect(titleScale("Certificado de excelência em vendas")).toBeLessThan(0.6);
  });
});

describe("certificado: modelos e logo própria", () => {
  it("aceita só modelos conhecidos e limita o tamanho da logo", () => {
    expect(sanitizeCertificate({ model: "moderno", logoHeight: 200, logoPath: "logo/0b7c1f7e-1111-4222-8333-944455556666.png" })).toEqual({
      model: "moderno",
      logoHeight: 70,
      logoPath: "logo/0b7c1f7e-1111-4222-8333-944455556666.png",
    });
    expect(sanitizeCertificate({ model: "constructor", logoPath: "https://x.com/a.png" })).toEqual({});
  });
});
