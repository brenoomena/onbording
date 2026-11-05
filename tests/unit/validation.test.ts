import { describe, expect, it } from "vitest";
import { profileCreateSchema, roleKeyFromName, passwordSchema } from "@/lib/validation";
import { visibleMenu, P } from "@/lib/permissions";
import { friendlyError } from "@/lib/errors";

const roleId = "3f1c2b4a-5d6e-4f70-8a91-b2c3d4e5f607";

describe("validação de colaborador", () => {
  it("aceita um cadastro completo e normaliza o e-mail", () => {
    const r = profileCreateSchema.safeParse({
      full_name: "Carla Souza",
      email: "Carla@Implantta.com.br",
      role_id: roleId,
      status: "onboarding",
      admission_date: "2026-11-03",
      onboarding_start_date: "2026-11-03",
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.email).toBe("carla@implantta.com.br");
    expect(r.success && r.data.area_id).toBeNull();
  });

  it("recusa onboarding antes da admissão", () => {
    const r = profileCreateSchema.safeParse({
      full_name: "Carla Souza",
      email: "carla@implantta.com.br",
      role_id: roleId,
      status: "onboarding",
      admission_date: "2026-11-03",
      onboarding_start_date: "2026-11-01",
    });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].path).toEqual(["onboarding_start_date"]);
  });

  it("recusa e-mail inválido e status desconhecido", () => {
    const r = profileCreateSchema.safeParse({ full_name: "Carla", email: "carla", role_id: roleId, status: "x" });
    expect(r.success).toBe(false);
    const paths = !r.success ? r.error.issues.map((i) => i.path[0]) : [];
    expect(paths).toEqual(expect.arrayContaining(["email", "status"]));
  });
});

describe("senha", () => {
  it("exige 10 caracteres e confirmação igual", () => {
    expect(passwordSchema.safeParse({ password: "curta", confirm: "curta" }).success).toBe(false);
    expect(passwordSchema.safeParse({ password: "umaSenhaLonga1", confirm: "outra" }).success).toBe(false);
    expect(passwordSchema.safeParse({ password: "umaSenhaLonga1", confirm: "umaSenhaLonga1" }).success).toBe(true);
  });
});

describe("chave de perfil", () => {
  it("gera chave técnica sem acentos", () => {
    expect(roleKeyFromName("Gestão Comercial")).toBe("gestao_comercial");
    expect(roleKeyFromName("2º Nível")).toBe("perfil_2_nivel");
  });
});

describe("menu por permissão", () => {
  it("colaborador vê só painel e aprendizagem", () => {
    const items = visibleMenu(new Set([P.painelVer]), false).flatMap((g) => g.items.map((i) => i.label));
    expect(items).toEqual(["Painel", "Minhas trilhas", "Materiais", "Conquistas", "Certificados", "Comunicados"]);
  });

  it("supervisor vê 'Minha equipe'", () => {
    const items = visibleMenu(new Set([P.painelVer, P.equipeVer]), false).flatMap((g) => g.items.map((i) => i.label));
    expect(items).toEqual(["Painel", "Minhas trilhas", "Materiais", "Conquistas", "Certificados", "Comunicados", "Minha equipe", "Acompanhamento"]);
  });

  it("quem tem todas as permissões, mas não é administrador, não vê perfis nem configurações", () => {
    const items = visibleMenu(new Set(Object.values(P)), false).flatMap((g) => g.items.map((i) => i.label));
    expect(items).not.toContain("Perfis de acesso");
    expect(items).not.toContain("Configurações");
    expect(items).toContain("Auditoria");
  });

  it("administrador vê todos os menus", () => {
    const items = visibleMenu(new Set(Object.values(P)), true).flatMap((g) => g.items.map((i) => i.label));
    expect(items).toEqual(["Painel", "Minhas trilhas", "Materiais", "Conquistas", "Certificados", "Comunicados", "Trilhas", "Conteúdos", "Colaboradores", "Acompanhamento", "Áreas", "Cargos", "Níveis", "Perfis de acesso", "Configurações", "Auditoria"]);
  });

  it("acompanhamento aparece com progresso.ver, mesmo sem ver colaboradores", () => {
    const items = visibleMenu(new Set([P.progressoVer]), false).flatMap((g) => g.items.map((i) => i.label));
    expect(items).toEqual(["Minhas trilhas", "Materiais", "Conquistas", "Certificados", "Comunicados", "Acompanhamento"]);
  });

  it("estrutura aparece com qualquer uma das ações", () => {
    const items = visibleMenu(new Set([P.estruturaExcluir]), false).flatMap((g) => g.items.map((i) => i.label));
    expect(items).toEqual(["Minhas trilhas", "Materiais", "Conquistas", "Certificados", "Comunicados", "Áreas", "Cargos", "Níveis"]);
  });
});
