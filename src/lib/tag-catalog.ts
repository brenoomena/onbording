/**
 * Catálogo das etiquetas (Badge) do sistema: cada uma tem uma chave, a cor
 * padrão e, em algumas, um ícone. Em Configurações › Etiquetas o
 * Administrador troca a cor de qualquer uma (outra cor da paleta ou cores
 * próprias para os modos claro e escuro). Puro: servidor e navegador.
 */
import type { Tone } from "@/lib/tags";

export type TagIcon =
  | "check"
  | "partial"
  | "x"
  | "clock"
  | "target"
  | "hourglass"
  | "approved"
  | "failed"
  | "text"
  | "link"
  | "video"
  | "file"
  | "quiz";

export interface TagDef {
  label: string;
  tone: Tone;
  icon?: TagIcon;
}

export const TAG_GROUPS = [
  {
    key: "publicacao",
    label: "Situação de publicação",
    where: "Trilhas e conteúdos",
    tags: {
      "publicacao.rascunho": { label: "Rascunho", tone: "orange" },
      "publicacao.publicado": { label: "Publicado", tone: "ok" },
      "publicacao.arquivado": { label: "Arquivado", tone: "silver" },
    },
  },
  {
    key: "matricula",
    label: "Situação da matrícula",
    where: "Minhas trilhas, Painel, Matrículas, Acompanhamento",
    tags: {
      "matricula.nao_iniciada": { label: "Não iniciada", tone: "silver" },
      "matricula.em_andamento": { label: "Em andamento", tone: "blue" },
      "matricula.concluida": { label: "Concluída", tone: "ok" },
      "matricula.em_atraso": { label: "Em atraso", tone: "danger" },
    },
  },
  {
    key: "alerta",
    label: "Alertas do Acompanhamento",
    where: "Listas de pessoas e trilhas",
    tags: {
      "alerta.atraso": { label: "Prazo vencido / em atraso", tone: "danger" },
      "alerta.parada": { label: "Sem estudo / parada", tone: "orange" },
    },
  },
  {
    key: "material",
    label: "Tipo de material",
    where: "Conteúdos, Materiais, estudo",
    tags: {
      "material.texto": { label: "Texto", tone: "indigo", icon: "text" },
      "material.link": { label: "Link externo", tone: "teal", icon: "link" },
      "material.video": { label: "Vídeo", tone: "pink", icon: "video" },
      "material.arquivo": { label: "Arquivo", tone: "violet", icon: "file" },
      "material.avaliacao": { label: "Avaliação", tone: "gold", icon: "quiz" },
    },
  },
  {
    key: "nivel",
    label: "Nível do cargo",
    where: "Colaboradores, Cargos, Níveis",
    tags: {
      "nivel.junior": { label: "Júnior", tone: "blue" },
      "nivel.pleno": { label: "Pleno", tone: "silver" },
      "nivel.senior": { label: "Sênior", tone: "gold" },
      "nivel.lideranca": { label: "Especialista / Líder / Coordenador / Gerente", tone: "violet" },
      "nivel.outro": { label: "Outros nomes de nível", tone: "indigo" },
    },
  },
  {
    key: "colaborador",
    label: "Situação do colaborador",
    where: "Colaboradores, Painel",
    tags: {
      "colaborador.ativo": { label: "Ativo", tone: "ok" },
      "colaborador.onboarding": { label: "Em onboarding", tone: "violet" },
      "colaborador.inativo": { label: "Inativo", tone: "silver" },
    },
  },
  {
    key: "estrutura",
    label: "Estrutura",
    where: "Áreas, Cargos, Níveis",
    tags: {
      "estrutura.inativo": { label: "Inativo / Inativa", tone: "silver" },
      "estrutura.sem_niveis": { label: "Sem níveis", tone: "warn" },
    },
  },
  {
    key: "trilha",
    label: "Trilha e etapas",
    where: "Trilhas, Minhas trilhas, Conteúdos",
    tags: {
      "trilha.obrigatoria": { label: "Obrigatória", tone: "brand" },
      "trilha.etapa_obrigatoria": { label: "Etapa obrigatória", tone: "brand" },
      "trilha.etapa_opcional": { label: "Etapa opcional", tone: "neutral" },
      "trilha.biblioteca": { label: "Biblioteca", tone: "brand" },
    },
  },
  {
    key: "avaliacao",
    label: "Avaliação · para quem faz",
    where: "Página da prova",
    tags: {
      "avaliacao.nota_minima": { label: "Nota mínima", tone: "gold", icon: "target" },
      "avaliacao.aguardando_topo": { label: "Aguardando correção (topo)", tone: "blue", icon: "hourglass" },
      "avaliacao.aguardando_resultado": { label: "Aguardando correção (resultado)", tone: "brand", icon: "hourglass" },
      "avaliacao.aprovado": { label: "Aprovado", tone: "ok", icon: "approved" },
      "avaliacao.nao_atingiu": { label: "Não atingiu a nota", tone: "danger", icon: "failed" },
    },
  },
  {
    key: "pergunta",
    label: "Avaliação · por pergunta",
    where: "Revisão da tentativa e correção",
    tags: {
      "pergunta.certa": { label: "Certa", tone: "ok", icon: "check" },
      "pergunta.parcial": { label: "Parcial", tone: "orange", icon: "partial" },
      "pergunta.errada": { label: "Errada", tone: "danger", icon: "x" },
      "pergunta.em_correcao": { label: "Em correção", tone: "blue", icon: "clock" },
    },
  },
  {
    key: "correcao",
    label: "Avaliação · correção do gestor",
    where: "Acompanhamento › Corrigir",
    tags: {
      "correcao.aguardando": { label: "Aguardando correção", tone: "blue" },
      "correcao.aprovada": { label: "Aprovada", tone: "ok" },
      "correcao.reprovada": { label: "Reprovada", tone: "danger" },
    },
  },
  {
    key: "estudo",
    label: "Estudo e materiais",
    where: "Etapa e Materiais",
    tags: {
      "estudo.concluido": { label: "Concluído em…", tone: "ok" },
      "estudo.visto": { label: "Visto", tone: "ok" },
    },
  },
  {
    key: "permissao",
    label: "Permissões",
    where: "Colaboradores e Perfis",
    tags: {
      "permissao.tem_acesso": { label: "Tem acesso", tone: "ok" },
      "permissao.sem_acesso": { label: "Sem acesso", tone: "neutral" },
      "permissao.liberado": { label: "Liberado", tone: "ok" },
      "permissao.bloqueado": { label: "Bloqueado", tone: "danger" },
    },
  },
  {
    key: "comunicado",
    label: "Comunicados",
    where: "Comunicados",
    tags: {
      "comunicado.importante": { label: "Importante", tone: "danger" },
      "comunicado.rascunho": { label: "Rascunho", tone: "warn" },
      "comunicado.publicado": { label: "Publicado", tone: "ok" },
      "comunicado.arquivado": { label: "Arquivado", tone: "neutral" },
    },
  },
  {
    key: "email",
    label: "Envio de e-mails",
    where: "Configurações › E-mails",
    tags: {
      "email.pendente": { label: "Na fila", tone: "silver", icon: "clock" },
      "email.enviando": { label: "Enviando", tone: "blue", icon: "hourglass" },
      "email.enviado": { label: "Enviado", tone: "ok", icon: "check" },
      "email.erro": { label: "Erro", tone: "danger", icon: "x" },
      "email.ignorado": { label: "Não enviado", tone: "neutral" },
    },
  },
] as const satisfies readonly { key: string; label: string; where: string; tags: Record<string, TagDef> }[];

type Groups = (typeof TAG_GROUPS)[number];
export type TagKey = { [G in Groups as G["key"]]: keyof G["tags"] }[Groups["key"]] & string;

export const TAGS: Record<TagKey, TagDef> = Object.assign({}, ...TAG_GROUPS.map((g) => g.tags));

export const TONES: Tone[] = ["ok", "warn", "danger", "brand", "neutral", "blue", "indigo", "violet", "teal", "pink", "orange", "silver", "gold"];
export const TONE_LABEL: Record<Tone, string> = {
  ok: "Verde (sucesso)",
  warn: "Amarelo (aviso)",
  danger: "Vermelho (erro)",
  brand: "Cor da marca",
  neutral: "Neutro",
  blue: "Azul",
  indigo: "Índigo",
  violet: "Violeta",
  teal: "Verde-água",
  pink: "Rosa",
  orange: "Laranja",
  silver: "Prata",
  gold: "Dourado",
};

/** Ajuste de uma etiqueta: outra cor da paleta ou cores próprias. */
export type TagOverride = { tone: Tone } | { custom: { lt: string; lb: string; dt: string; db: string } };
export type TagTheme = Partial<Record<TagKey, TagOverride>>;

const HEX = /^#[0-9a-f]{6}$/i;

export function isTagKey(k: unknown): k is TagKey {
  return typeof k === "string" && Object.hasOwn(TAGS, k);
}

export function sanitizeTags(raw: unknown): TagTheme {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: TagTheme = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isTagKey(k) || !v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    if (typeof o.tone === "string" && (TONES as string[]).includes(o.tone)) {
      if (o.tone !== TAGS[k].tone) out[k] = { tone: o.tone as Tone };
    } else if (o.custom && typeof o.custom === "object") {
      const c = o.custom as Record<string, unknown>;
      if (["lt", "lb", "dt", "db"].every((x) => typeof c[x] === "string" && HEX.test(c[x] as string))) {
        out[k] = { custom: { lt: (c.lt as string).toLowerCase(), lb: (c.lb as string).toLowerCase(), dt: (c.dt as string).toLowerCase(), db: (c.db as string).toLowerCase() } };
      }
    }
  }
  return out;
}

/** Variáveis CSS (r g b) do texto e do fundo de cada cor da paleta. */
const TONE_VARS: Record<Tone, [string, string]> = {
  ok: ["ok", "ok-soft"],
  warn: ["warn", "warn-soft"],
  danger: ["danger", "danger-soft"],
  brand: ["accent", "accent-soft"],
  neutral: ["muted", "sunken"],
  blue: ["tag-blue", "tag-blue-soft"],
  indigo: ["tag-indigo", "tag-indigo-soft"],
  violet: ["tag-violet", "tag-violet-soft"],
  teal: ["tag-teal", "tag-teal-soft"],
  pink: ["tag-pink", "tag-pink-soft"],
  orange: ["tag-orange", "tag-orange-soft"],
  silver: ["tag-silver", "tag-silver-soft"],
  gold: ["tag-gold", "tag-gold-soft"],
};
export { TONE_VARS };

function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/**
 * CSS dos ajustes: vale sobre as classes padrão do Badge (seletor
 * span[data-tag] é mais específico). Valores já validados.
 */
export function tagsCss(theme: TagTheme): string {
  let light = "";
  let dark = "";
  for (const [k, o] of Object.entries(theme) as [TagKey, TagOverride][]) {
    const sel = `span[data-tag="${k}"]`;
    if ("tone" in o) {
      const [t, b] = TONE_VARS[o.tone];
      light += `${sel}{color:rgb(var(--${t}));background-color:rgb(var(--${b}));box-shadow:none}`;
    } else {
      light += `${sel}{color:rgb(${rgb(o.custom.lt)});background-color:rgb(${rgb(o.custom.lb)});box-shadow:none}`;
      dark += `${sel}{color:rgb(${rgb(o.custom.dt)});background-color:rgb(${rgb(o.custom.db)})}`;
    }
  }
  if (!light) return "";
  const darkScoped = dark
    ? `@media (prefers-color-scheme: dark){${dark.replace(/span\[data-tag/g, ':root:not([data-theme="light"]) span[data-tag')}}` +
      dark.replace(/span\[data-tag/g, ':root[data-theme="dark"] span[data-tag')
    : "";
  return light + darkScoped;
}
