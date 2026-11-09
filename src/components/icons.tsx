import { Award, BookOpenCheck, Briefcase, Building2, ChartColumnIncreasing, ClipboardList, FileStack, ListChecks, History, Layers, LayoutDashboard, LibraryBig, Megaphone, Palette, Route, ShieldCheck, Trophy, UserRound, Users, type LucideIcon } from "lucide-react";
import type { IconName } from "@/lib/permissions";

/** Ícones dos módulos (menu, barra superior e cabeçalhos). Um só lugar para manter o padrão. */
export const MODULE_ICONS: Record<IconName, LucideIcon> = {
  painel: LayoutDashboard,
  trilha: BookOpenCheck,
  materiais: LibraryBig,
  certificado: Award,
  comunicados: Megaphone,
  conquistas: Trophy,
  tarefas: ListChecks,
  checklists: ClipboardList,
  trilhas: Route,
  conteudos: FileStack,
  colaboradores: Users,
  areas: Building2,
  cargos: Briefcase,
  niveis: Layers,
  perfis: ShieldCheck,
  configuracoes: Palette,
  auditoria: History,
  acompanhamento: ChartColumnIncreasing,
  "meu-perfil": UserRound,
};

export function ModuleIcon({ name, className, size = 18 }: { name: IconName; className?: string; size?: number }) {
  const I = MODULE_ICONS[name];
  return <I aria-hidden size={size} strokeWidth={1.9} className={className} />;
}

/** Quadradinho com ícone, usado nos cabeçalhos e cartões. */
export function IconTile({
  icon: I,
  tone = "brand",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  tone?: "brand" | "ok" | "warn" | "danger" | "neutral";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tones = {
    brand: "bg-icon-bg text-icon",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    neutral: "bg-sunken text-muted",
  } as const;
  const sizes = { sm: "h-8 w-8 rounded-lg", md: "h-11 w-11 rounded-xl", lg: "h-12 w-12 rounded-xl" } as const;
  const px = { sm: 16, md: 20, lg: 22 } as const;
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center ${sizes[size]} ${tones[tone]} ${className ?? ""}`}>
      <I size={px[size]} strokeWidth={1.9} />
    </span>
  );
}
