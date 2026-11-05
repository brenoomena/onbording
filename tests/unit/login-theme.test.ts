import { describe, expect, it } from "vitest";
import { DEFAULT_LOGIN, diffLogin, fontsUrl, resolveLogin, sanitizeLogin } from "@/lib/login-theme";

describe("login-theme", () => {
  it("descarta valores inválidos e limita números e textos", () => {
    const s = sanitizeLogin({
      from: "red",
      to: "#ABCDEF",
      angle: 999,
      speed: 0,
      effect: "fogos",
      card: "escuro",
      title: "  Entrar   agora ",
      headline: "x".repeat(300),
      extra: "<script>",
    });
    expect(s).toEqual({ to: "#abcdef", angle: 360, speed: 1, card: "escuro", title: "Entrar agora", headline: "x".repeat(80) });
  });

  it("guarda só o que difere do padrão", () => {
    expect(diffLogin({ ...DEFAULT_LOGIN, effect: "nenhum" })).toEqual({ effect: "nenhum" });
    expect(diffLogin(DEFAULT_LOGIN)).toEqual({});
  });

  it("completa com o padrão; o padrão começa no #14afcc", () => {
    expect(resolveLogin({ effect: "constelacao" })).toEqual({ ...DEFAULT_LOGIN, effect: "constelacao" });
    expect(DEFAULT_LOGIN.from).toBe("#14afcc");
  });

  it("aceita entrada vazia ou estranha", () => {
    expect(sanitizeLogin(null)).toEqual({});
    expect(sanitizeLogin([1, 2])).toEqual({});
  });
});

describe("login-theme: efeitos, área e fontes", () => {
  it("aceita os efeitos e áreas conhecidos e limita tamanhos", () => {
    const s = sanitizeLogin({ effect: "ondas", effectArea: "direita", headlineFont: "poppins", headlineSize: 99, subtitleSize: 12.3, titleFont: "comic" });
    expect(s).toEqual({ effect: "ondas", effectArea: "direita", headlineFont: "poppins", headlineSize: 56, subtitleSize: 12.5 });
    expect(sanitizeLogin({ effect: "toString", effectArea: "constructor" })).toEqual({});
  });

  it("carrega só as fontes do Google escolhidas, sem repetir", () => {
    expect(fontsUrl(DEFAULT_LOGIN)).toBeNull();
    const url = fontsUrl({ ...DEFAULT_LOGIN, headlineFont: "poppins", titleFont: "poppins", taglineFont: "playfair" });
    expect(url).toBe("https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap");
  });
});
