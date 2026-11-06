import { describe, expect, it } from "vitest";
import { DEFAULT_SCROLLBAR, isDefaultScrollbar, sanitizeScrollbar, scrollbarCss } from "@/lib/scrollbar";

describe("barra de rolagem do menu", () => {
  it("valores inválidos voltam ao padrão", () => {
    const s = sanitizeScrollbar({ width: "enorme", shape: 3, visibility: "x", light: { thumb: "red;}body{", hover: "#ABCDEF", track: "" }, dark: null });
    expect(s.width).toBe("fina");
    expect(s.shape).toBe("arredondada");
    expect(s.visibility).toBe("sempre");
    expect(s.light.thumb).toBe(DEFAULT_SCROLLBAR.light.thumb);
    expect(s.light.hover).toBe("#abcdef");
    expect(s.light.track).toBe("");
    expect(s.dark).toEqual(DEFAULT_SCROLLBAR.dark);
    expect(isDefaultScrollbar(sanitizeScrollbar(undefined))).toBe(true);
  });

  it("gera a largura, o formato e as cores dos dois modos", () => {
    const css = scrollbarCss({ ...DEFAULT_SCROLLBAR, width: "larga", shape: "reta", light: { thumb: "#111111", hover: "#222222", track: "#333333" } });
    expect(css).toContain(".sidebar-scroll::-webkit-scrollbar{width:14px");
    expect(css).toContain("border-radius:0");
    expect(css).toContain("--sb-thumb:#111111;--sb-hover:#222222;--sb-track:#333333;");
    expect(css).toContain(`:root[data-theme="dark"]{--sb-thumb:${DEFAULT_SCROLLBAR.dark.thumb}`);
    expect(css).toContain("--sb-track:transparent");
  });

  it("só ao passar o mouse e oculta", () => {
    expect(scrollbarCss({ ...DEFAULT_SCROLLBAR, visibility: "passar" })).toContain(".sidebar-scroll:not(:hover)::-webkit-scrollbar-thumb{background-color:transparent}");
    const hidden = scrollbarCss({ ...DEFAULT_SCROLLBAR, visibility: "oculta" });
    expect(hidden).toContain("scrollbar-width:none");
    expect(hidden).toContain("display:none");
  });

  it("prévia usa um modo só no seletor indicado", () => {
    const css = scrollbarCss(DEFAULT_SCROLLBAR, ".sb-prev-dark", { mode: "dark" });
    expect(css.startsWith(`.sb-prev-dark{--sb-thumb:${DEFAULT_SCROLLBAR.dark.thumb}`)).toBe(true);
    expect(css).not.toContain(":root");
  });
});
