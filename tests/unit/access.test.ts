import { describe, expect, it } from "vitest";
import { decideAccess, deniedFromProviderError, safeNext } from "@/lib/access";

describe("acesso com Google", () => {
  it("só entra quem tem cadastro ativo", () => {
    expect(decideAccess("ana@implantta.com.br", { status: "ativo" }, "")).toEqual({ ok: true });
    expect(decideAccess("ana@implantta.com.br", { status: "onboarding" }, "")).toEqual({ ok: true });
    expect(decideAccess("ana@implantta.com.br", null, "")).toEqual({ ok: false, reason: "nao-liberado" });
    expect(decideAccess("ana@implantta.com.br", { status: "inativo" }, "")).toEqual({ ok: false, reason: "inativo" });
  });

  it("domínio, quando configurado, vale antes de tudo", () => {
    expect(decideAccess("Ana@Implantta.com.br", { status: "ativo" }, "implantta.com.br")).toEqual({ ok: true });
    expect(decideAccess("ana@gmail.com", { status: "ativo" }, "implantta.com.br")).toEqual({ ok: false, reason: "dominio" });
    expect(decideAccess("ana@gmail.com", { status: "ativo" }, "")).toEqual({ ok: true });
  });

  it("traduz o erro devolvido pelo Supabase/Google", () => {
    expect(deniedFromProviderError("access_denied", "Signups not allowed for this instance")).toBe("nao-liberado");
    expect(deniedFromProviderError("signup_disabled", null)).toBe("nao-liberado");
    expect(deniedFromProviderError("access_denied", "The user denied access")).toBe("cancelado");
    expect(deniedFromProviderError("server_error", "boom")).toBe("google");
  });

  it("next só aceita caminhos internos", () => {
    expect(safeNext("/trilhas")).toBe("/trilhas");
    expect(safeNext("//evil.com")).toBe("/painel");
    expect(safeNext("https://evil.com")).toBe("/painel");
    expect(safeNext(null)).toBe("/painel");
  });
});
