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
