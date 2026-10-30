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
