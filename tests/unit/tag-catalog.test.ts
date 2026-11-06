import { describe, expect, it } from "vitest";
import { TAGS, sanitizeTags, tagsCss } from "@/lib/tag-catalog";

describe("etiquetas", () => {
  it("aceita só chaves e cores válidas; tom igual ao padrão não é guardado", () => {
    const s = sanitizeTags({
      "material.texto": { tone: "gold" },
      "material.video": { tone: "pink" },
      "nivel.pleno": { custom: { lt: "#123456", lb: "#ABCDEF", dt: "#ffffff", db: "#000000" } },
      "nivel.senior": { custom: { lt: "red" } },
      "constructor": { tone: "ok" },
      "x.y": { tone: "ok" },
      "matricula.concluida": { tone: "roxo" },
    });
    expect(s).toEqual({
      "material.texto": { tone: "gold" },
      "nivel.pleno": { custom: { lt: "#123456", lb: "#abcdef", dt: "#ffffff", db: "#000000" } },
    });
  });

  it("CSS: tom da paleta usa variáveis; cores próprias valem nos dois modos", () => {
    const css = tagsCss({ "material.texto": { tone: "gold" }, "nivel.pleno": { custom: { lt: "#123456", lb: "#abcdef", dt: "#ffffff", db: "#000000" } } });
    expect(css).toContain('span[data-tag="material.texto"]{color:rgb(var(--tag-gold));background-color:rgb(var(--tag-gold-soft))');
    expect(css).toContain('span[data-tag="nivel.pleno"]{color:rgb(18 52 86)');
    expect(css).toContain(':root[data-theme="dark"] span[data-tag="nivel.pleno"]{color:rgb(255 255 255)');
    expect(tagsCss({})).toBe("");
  });

  it("os ícones pedidos existem no catálogo", () => {
    for (const k of ["pergunta.certa", "pergunta.parcial", "pergunta.errada", "pergunta.em_correcao", "avaliacao.nota_minima", "avaliacao.aguardando_topo", "avaliacao.aguardando_resultado", "avaliacao.aprovado", "avaliacao.nao_atingiu", "material.texto", "material.link", "material.video", "material.arquivo", "material.avaliacao"] as const) {
      expect(TAGS[k].icon, k).toBeTruthy();
    }
  });
});
