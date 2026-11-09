/** Checklist de integração: tipos e textos. Puro: servidor e navegador. */

export type ResponsibleKind = "rh" | "supervisor" | "colaborador" | "pessoa";

export const RESPONSIBLE_LABEL: Record<ResponsibleKind, string> = {
  rh: "RH",
  supervisor: "Supervisor",
  colaborador: "Colaborador",
  pessoa: "Pessoa específica",
};

export const RESPONSIBLE_HINT: Record<ResponsibleKind, string> = {
  rh: "Quem tem a permissão de gerenciar checklists",
  supervisor: "O supervisor atual da pessoa (sem supervisor, o RH)",
  colaborador: "O próprio novo colaborador",
  pessoa: "Alguém escolhido, ex.: TI ou facilities",
};

export interface TemplateItem {
  title: string;
  description: string;
  responsibleKind: ResponsibleKind;
  responsibleId: string;
  offsetDays: number;
}

export const OFFSET_PRESETS = [-7, -3, -1, 0, 1, 7, 30, 60, 90] as const;

/** "3 dias antes da admissão", "no dia da admissão", "30 dias depois". */
export function offsetLabel(d: number): string {
  if (d === 0) return "No dia da admissão";
  const n = Math.abs(d);
  return `${n} ${n === 1 ? "dia" : "dias"} ${d < 0 ? "antes da admissão" : "depois da admissão"}`;
}

/** Valida a lista do editor antes de enviar ao banco. */
export function sanitizeItems(v: unknown): { items: TemplateItem[]; error?: string } {
  if (!Array.isArray(v)) return { items: [], error: "Lista de tarefas inválida." };
  if (v.length > 100) return { items: [], error: "Use no máximo 100 tarefas por modelo." };
  const kinds: ResponsibleKind[] = ["rh", "supervisor", "colaborador", "pessoa"];
  const items: TemplateItem[] = [];
  for (const [i, raw] of v.entries()) {
    const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const title = String(o.title ?? "").replace(/\s+/g, " ").trim();
    const description = String(o.description ?? "").trim();
    const kind = kinds.includes(o.responsibleKind as ResponsibleKind) ? (o.responsibleKind as ResponsibleKind) : "rh";
    const id = String(o.responsibleId ?? "");
    const offset = Math.trunc(Number(o.offsetDays ?? 0));
    if (title.length < 2) return { items: [], error: `Tarefa ${i + 1}: escreva o nome da tarefa.` };
    if (title.length > 160) return { items: [], error: `Tarefa ${i + 1}: use no máximo 160 caracteres no nome.` };
    if (description.length > 1000) return { items: [], error: `Tarefa ${i + 1}: a descrição passa de 1.000 caracteres.` };
    if (kind === "pessoa" && !/^[0-9a-f-]{36}$/i.test(id)) return { items: [], error: `Tarefa ${i + 1}: escolha a pessoa responsável.` };
    if (!Number.isFinite(offset) || offset < -90 || offset > 365) return { items: [], error: `Tarefa ${i + 1}: o prazo deve ficar entre 90 dias antes e 365 dias depois da admissão.` };
    items.push({ title, description, responsibleKind: kind, responsibleId: kind === "pessoa" ? id : "", offsetDays: offset });
  }
  return { items };
}

export type TaskState = "concluida" | "atrasada" | "hoje" | "proxima" | "sem_prazo";

export function taskState(t: { done_at: string | null; due_date: string | null }, today: string): TaskState {
  if (t.done_at) return "concluida";
  if (!t.due_date) return "sem_prazo";
  if (t.due_date < today) return "atrasada";
  if (t.due_date === today) return "hoje";
  return "proxima";
}

export const TASK_STATE_LABEL: Record<TaskState, string> = {
  concluida: "Concluída",
  atrasada: "Atrasada",
  hoje: "Vence hoje",
  proxima: "No prazo",
  sem_prazo: "Sem prazo",
};

/** Data de hoje em São Paulo, "AAAA-MM-DD". */
export function todaySP(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}
