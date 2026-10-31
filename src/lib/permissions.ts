/** Chaves de permissão. Devem existir na tabela public.permissions. */
export const P = {
  painelVer: "painel.ver",
  colaboradoresVer: "colaboradores.ver",
  equipeVer: "equipe.ver",
  colaboradoresCriar: "colaboradores.criar",
  colaboradoresEditar: "colaboradores.editar",
  colaboradoresDesativar: "colaboradores.desativar",
  estruturaCriar: "estrutura.criar",
  estruturaEditar: "estrutura.editar",
  estruturaExcluir: "estrutura.excluir",
  trilhasVer: "trilhas.ver",
  trilhasCriar: "trilhas.criar",
  trilhasEditar: "trilhas.editar",
  trilhasExcluir: "trilhas.excluir",
  trilhasMatricular: "trilhas.matricular",
  conteudosVer: "conteudos.ver",
  conteudosCriar: "conteudos.criar",
  conteudosEditar: "conteudos.editar",
  conteudosExcluir: "conteudos.excluir",
  progressoVer: "progresso.ver",
  auditoriaVer: "auditoria.ver",
} as const;

export type PermissionKey = (typeof P)[keyof typeof P];

export const ESTRUTURA_ANY: PermissionKey[] = [P.estruturaCriar, P.estruturaEditar, P.estruturaExcluir];

/** Nome do ícone (ver components/icons.tsx). */
export type IconName =
  | "painel" | "trilha" | "materiais" | "trilhas" | "conteudos" | "colaboradores" | "areas" | "cargos"
  | "niveis" | "perfis" | "configuracoes" | "auditoria" | "meu-perfil";

export interface MenuItem {
  href: string;
  label: string;
  icon: IconName;
  /** Exibe o item se o usuário tiver QUALQUER uma destas permissões. Vazio = todos. */
  anyOf: PermissionKey[];
  /** Só para o perfil Administrador (configurações e perfis de acesso). */
  adminOnly?: boolean;
}

export interface MenuGroup {
  label: string | null;
  items: MenuItem[];
}

export const MENU: MenuGroup[] = [
  {
    label: null,
    items: [{ href: "/painel", label: "Painel", icon: "painel", anyOf: [P.painelVer] }],
  },
  {
    label: "Aprendizagem",
    items: [
      { href: "/minhas-trilhas", label: "Minhas trilhas", icon: "trilha", anyOf: [] },
      { href: "/materiais", label: "Materiais", icon: "materiais", anyOf: [] },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/trilhas", label: "Trilhas", icon: "trilhas", anyOf: [P.trilhasVer] },
      { href: "/conteudos", label: "Conteúdos", icon: "conteudos", anyOf: [P.conteudosVer] },
      { href: "/colaboradores", label: "Colaboradores", icon: "colaboradores", anyOf: [P.colaboradoresVer, P.equipeVer] },
    ],
  },
  {
    label: "Estrutura",
    items: [
      { href: "/estrutura/areas", label: "Áreas", icon: "areas", anyOf: ESTRUTURA_ANY },
      { href: "/estrutura/cargos", label: "Cargos", icon: "cargos", anyOf: ESTRUTURA_ANY },
      { href: "/estrutura/niveis", label: "Níveis", icon: "niveis", anyOf: ESTRUTURA_ANY },
    ],
  },
  {
    label: "Administração",
    items: [
      { href: "/perfis", label: "Perfis de acesso", icon: "perfis", anyOf: [], adminOnly: true },
      { href: "/configuracoes", label: "Configurações", icon: "configuracoes", anyOf: [], adminOnly: true },
      { href: "/auditoria", label: "Auditoria", icon: "auditoria", anyOf: [P.auditoriaVer] },
    ],
  },
];

export function visibleMenu(perms: ReadonlySet<string>, isAdmin: boolean): MenuGroup[] {
  return MENU.map((g) => ({
    ...g,
    items: g.items
      .filter((i) => (i.adminOnly ? isAdmin : i.anyOf.length === 0 || i.anyOf.some((k) => perms.has(k))))
      .map((i) =>
        i.href === "/colaboradores" && !perms.has(P.colaboradoresVer) ? { ...i, label: "Minha equipe" } : i,
      ),
  })).filter((g) => g.items.length > 0);
}

/** Título do módulo de cada rota, para a barra superior. */
export function sectionFor(pathname: string): { group: string; label: string; icon: IconName } | null {
  for (const g of MENU) {
    for (const i of g.items) {
      if (pathname === i.href || pathname.startsWith(`${i.href}/`)) return { group: g.label ?? "Início", label: i.label, icon: i.icon };
    }
  }
  if (pathname.startsWith("/estudar")) return { group: "Aprendizagem", label: "Estudo", icon: "trilha" };
  if (pathname.startsWith("/meu-perfil")) return { group: "Conta", label: "Meu perfil", icon: "meu-perfil" };
  return null;
}
