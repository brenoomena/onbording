import { describe, expect, it } from "vitest";
import { embedUrl, formatMinutes, itemStates, type TrackModule } from "@/lib/learning";

const item = (id: string, pos: number, required = true) => ({
  id,
  module_id: "m",
  position: pos,
  is_required: required,
  content: { id: `c-${id}`, title: id, kind: "link" as const, external_platform: null, estimated_minutes: null, status: "publicado" as const, category: null },
});

describe("estado dos itens da trilha", () => {
  const modules: TrackModule[] = [
    { id: "m1", title: "1", description: null, position: 1, items: [item("a", 1), item("b", 2)] },
    { id: "m2", title: "2", description: null, position: 2, items: [item("c", 1), item("opc", 2, false)] },
  ];

  it("em sequência, libera só o próximo obrigatório e sempre os opcionais", () => {
    const s = itemStates(modules, new Set(["c-a"]), true);
    expect(Object.fromEntries(s)).toEqual({ a: "concluido", b: "liberado", c: "bloqueado", opc: "liberado" });
  });

  it("fora de sequência, tudo fica liberado", () => {
    const s = itemStates(modules, new Set(), false);
    expect([...s.values()].every((v) => v === "liberado")).toBe(true);
  });
});

describe("vídeos incorporados", () => {
  it("converte YouTube, Vimeo e Drive", () => {
    expect(embedUrl("https://www.youtube.com/watch?v=abc123")).toBe("https://www.youtube-nocookie.com/embed/abc123");
    expect(embedUrl("https://youtu.be/xyz")).toBe("https://www.youtube-nocookie.com/embed/xyz");
    expect(embedUrl("https://vimeo.com/12345")).toBe("https://player.vimeo.com/video/12345");
    expect(embedUrl("https://drive.google.com/file/d/ID_1/view?usp=drivesdk")).toBe("https://drive.google.com/file/d/ID_1/preview");
    expect(embedUrl("https://docs.google.com/presentation/d/ABC/edit#slide=id.p")).toBe("https://docs.google.com/presentation/d/ABC/preview");
    expect(embedUrl("https://dominiosistemas.learning.rocks/contents/1")).toBeNull();
    expect(embedUrl("https://exemplo.com/video.mp4")).toBeNull();
  });
});

describe("tempo", () => {
  it("formata minutos e horas", () => {
    expect(formatMinutes(0)).toBe("—");
    expect(formatMinutes(40)).toBe("< 1 min");
    expect(formatMinutes(34 * 60)).toBe("34 min");
    expect(formatMinutes(125 * 60)).toBe("2 h 5 min");
  });
});

import { initials, normalizeUrl, plainText } from "@/lib/text";

describe("plainText", () => {
  it("tira as marcações e junta as linhas", () => {
    expect(plainText("**Login:** `ana@x.com`\n**Senha:** `123`")).toBe("Login: ana@x.com · Senha: 123");
    expect(plainText("### Título\n- item [site](https://a.b)")).toBe("Título · item site");
    expect(plainText(null)).toBe("");
  });
});

describe("normalizeUrl", () => {
  it("completa endereços digitados sem https", () => {
    expect(normalizeUrl("implantta.com.br")).toBe("https://implantta.com.br");
    expect(normalizeUrl("www.site.com/a?b=1")).toBe("https://www.site.com/a?b=1");
    expect(normalizeUrl("https://x.com/a(b)")).toBe("https://x.com/a%28b%29");
    expect(normalizeUrl("ana@implantta.com.br")).toBe("mailto:ana@implantta.com.br");
    expect(normalizeUrl("abvcsaas")).toBeNull();
    expect(normalizeUrl("dois termos.com")).toBeNull();
  });
});

describe("initials", () => {
  it("usa a primeira letra do nome e do último sobrenome", () => {
    expect(initials("Breno da Silva Omena")).toBe("BO");
    expect(initials("ana")).toBe("A");
    expect(initials("  ")).toBe("?");
    expect(initials("Élida Ávila")).toBe("ÉÁ");
  });
});

import { isDark, sanitizeTheme, themeCss } from "@/lib/theme-tokens";

describe("tema personalizado", () => {
  it("aceita só tokens conhecidos com cor #RRGGBB", () => {
    const t = sanitizeTheme({ light: { brand: "#FF6600", hack: "#000000", ink: "red;}body{x:y" }, dark: "nada", outro: {} });
    expect(t).toEqual({ light: { brand: "#ff6600" } });
  });
  it("gera variáveis RGB para os dois modos", () => {
    const css = themeCss({ light: { brand: "#ff6600" }, dark: { brand: "#00ff00" } });
    expect(css).toContain("--brand:255 102 0;");
    expect(css).toContain(':root[data-theme="dark"]{');
    expect(css).toContain("--brand:0 255 0;");
    expect(css).not.toContain("hack");
  });
  it("identifica fundo escuro para escolher a logo", () => {
    expect(isDark("#0f1b2d")).toBe(true);
    expect(isDark("#ffffff")).toBe(false);
  });
});

import { defaultSize, fromHeight, fromWidth, sanitizeSizes, sizeRange } from "@/lib/logo-sizes";

describe("tamanho das logos", () => {
  it("faixa da logo respeita os limites absolutos e a proporção", () => {
    // Logo 4:1 → largura 80–220, altura 20–55
    expect(sizeRange("logo", 4)).toEqual({ wMin: 80, wMax: 220, hMin: 20, hMax: 55 });
    // Logo 2:1 → altura limita: largura 80–160 (h 40–80)
    expect(sizeRange("logo", 2)).toEqual({ wMin: 80, wMax: 160, hMin: 40, hMax: 80 });
  });
  it("não deixa passar do mínimo nem do máximo e mantém a proporção", () => {
    expect(fromWidth("logo", 4, 500)).toEqual({ w: 220, h: 55 });
    expect(fromWidth("logo", 4, 10)).toEqual({ w: 80, h: 20 });
    expect(fromHeight("logo", 4, 30)).toEqual({ w: 120, h: 30 });
    expect(fromWidth("symbol", 1, 100)).toEqual({ w: 52, h: 52 });
    expect(fromWidth("symbol", 1, 1)).toEqual({ w: 24, h: 24 });
  });
  it("tamanho padrão: logo com 175px de largura, símbolo com 36px de altura", () => {
    expect(defaultSize("logo", 4)).toEqual({ w: 175, h: 44 });
    expect(defaultSize("symbol", 1)).toEqual({ w: 36, h: 36 });
  });
  it("descarta tamanhos fora dos limites ou de variantes desconhecidas", () => {
    expect(sanitizeSizes({ logo: { w: 175, h: 44 }, symbol: { w: 99, h: 99 }, outro: { w: 1, h: 1 } })).toEqual({ logo: { w: 175, h: 44 } });
  });
});

import { levelTone } from "@/lib/tags";

describe("cores dos níveis", () => {
  it("Júnior azul, Pleno prata, Sênior dourado (com ou sem acento)", () => {
    expect(levelTone("Júnior")).toBe("blue");
    expect(levelTone("junior")).toBe("blue");
    expect(levelTone("Analista Jr")).toBe("blue");
    expect(levelTone("Pleno")).toBe("silver");
    expect(levelTone("Sênior")).toBe("gold");
    expect(levelTone("SENIOR")).toBe("gold");
    expect(levelTone("Especialista")).toBe("violet");
    expect(levelTone("Trainee")).toBe("indigo");
  });
});
