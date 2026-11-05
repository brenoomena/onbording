import { describe, expect, it } from "vitest";
import { DEFAULT_LOGIN, diffLogin, resolveLogin, sanitizeLogin } from "@/lib/login-theme";

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
