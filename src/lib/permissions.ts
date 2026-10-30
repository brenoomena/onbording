/** Chaves de permissão da Etapa 1. Devem existir na tabela public.permissions. */
export const P = {
  painelVer: "painel.ver",
  colaboradoresVer: "colaboradores.ver",
  colaboradoresGerenciar: "colaboradores.gerenciar",
  equipeVer: "equipe.ver",
  estruturaGerenciar: "estrutura.gerenciar",
  perfisGerenciar: "perfis.gerenciar",
  auditoriaVer: "auditoria.ver",
} as const;

export type PermissionKey = (typeof P)[keyof typeof P];

export interface MenuItem {
  href: string;
  label: string;
  /** Exibe o item se o usuário tiver QUALQUER uma destas permissões. Vazio = todos. */
  anyOf: PermissionKey[];
}

export interface MenuGroup {
  label: string | null;
  items: MenuItem[];
}

export const MENU: MenuGroup[] = [
  {
    label: null,
    items: [{ href: "/painel", label: "Painel", anyOf: [P.painelVer] }],
  },
  {
    label: "Pessoas",
    items: [{ href: "/colaboradores", label: "Colaboradores", anyOf: [P.colaboradoresVer, P.equipeVer] }],
  },
  {
    label: "Estrutura",
    items: [
      { href: "/estrutura/areas", label: "Áreas", anyOf: [P.estruturaGerenciar] },
      { href: "/estrutura/cargos", label: "Cargos", anyOf: [P.estruturaGerenciar] },
      { href: "/estrutura/niveis", label: "Níveis", anyOf: [P.estruturaGerenciar] },
    ],
  },
  {
    label: "Administração",
    items: [
      { href: "/perfis", label: "Perfis de acesso", anyOf: [P.perfisGerenciar] },
      { href: "/auditoria", label: "Auditoria", anyOf: [P.auditoriaVer] },
    ],
  },
  {
    label: null,
    items: [{ href: "/meu-perfil", label: "Meu perfil", anyOf: [] }],
  },
];

export function visibleMenu(perms: ReadonlySet<string>): MenuGroup[] {
  return MENU.map((g) => ({
    ...g,
    items: g.items
      .filter((i) => i.anyOf.length === 0 || i.anyOf.some((k) => perms.has(k)))
      .map((i) =>
        i.href === "/colaboradores" && !perms.has(P.colaboradoresVer) ? { ...i, label: "Minha equipe" } : i,
      ),
  })).filter((g) => g.items.length > 0);
}
