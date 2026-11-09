/** Gamificação: rótulos e cores. Puro (servidor e navegador). */

export interface Badge {
  key: string;
  name: string;
  description: string;
  icon: string;
  tone: string;
  sort_order: number;
}

export interface MyGamification {
  total: number;
  month: number;
  rank_total: number | null;
  rank_month: number | null;
  area_size: number;
  badges: number;
  badges_total: number;
}

export interface RankingRow {
  profile_id: string;
  full_name: string;
  avatar_path: string | null;
  area_name: string | null;
  points: number;
  badges: number;
  rank: number;
}

export const REASON_LABEL: Record<string, string> = {
  etapa_obrigatoria: "Etapa obrigatória",
  etapa_opcional: "Etapa opcional",
  avaliacao: "Avaliação aprovada",
  avaliacao_primeira: "Aprovado de primeira",
  trilha: "Trilha concluída",
  trilha_no_prazo: "Trilha no prazo",
  tarefa: "Tarefa de integração",
  checklist: "Checklist concluído",
};

/** Tabela de pontos (mesma regra do banco), para mostrar na tela. */
export const POINTS_RULES: [string, number][] = [
  ["Etapa obrigatória concluída", 10],
  ["Etapa opcional concluída", 5],
  ["Avaliação aprovada", 20],
  ["Aprovado na primeira tentativa", 10],
  ["Trilha concluída", 50],
  ["Trilha concluída dentro do prazo", 25],
  ["Tarefa de integração feita por você", 5],
  ["Checklist de integração concluído", 20],
];

/** Classes de cor (fundo suave + ícone) de cada tom de medalha. */
export const BADGE_TONE: Record<string, string> = {
  blue: "bg-tag-blue-soft text-tag-blue ring-tag-blue/30",
  teal: "bg-tag-teal-soft text-tag-teal ring-tag-teal/30",
  violet: "bg-tag-violet-soft text-tag-violet ring-tag-violet/30",
  gold: "bg-tag-gold-soft text-tag-gold ring-tag-gold/40",
  orange: "bg-tag-orange-soft text-tag-orange ring-tag-orange/30",
  ok: "bg-ok-soft text-ok ring-ok/30",
  pink: "bg-tag-pink-soft text-tag-pink ring-tag-pink/30",
};

export function formatPoints(n: number): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? "ponto" : "pontos"}`;
}
