/**
 * Acompanhamento: regras de cálculo da visão consolidada de progresso.
 * Funções puras (sem banco), usadas pela página, pela exportação e pelos testes.
 */

export type EnrollmentStatus = "nao_iniciada" | "em_andamento" | "concluida";
/** Situação mostrada: a da matrícula, ou "atrasada" quando o prazo venceu sem concluir. */
export type Situacao = EnrollmentStatus | "atrasada";

export const SITUACAO_LABEL: Record<Situacao, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  atrasada: "Em atraso",
};

/** Opções do filtro "sem atividade há" (dias). */
export const PARADO_OPCOES = [7, 15, 30, 60] as const;
export const PARADO_PADRAO = 15;

export interface EnrollmentRow {
  id: string;
  profile_id: string;
  track_id: string;
  status: EnrollmentStatus;
  progress_percent: number;
  due_date: string | null;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface PersonInfo {
  id: string;
  full_name: string;
  email: string;
  status: string;
  area_id: string | null;
  position_id: string | null;
  level_id: string | null;
  supervisor_id: string | null;
  admission_date: string | null;
  last_access_at: string | null;
}

export interface TrackInfo {
  id: string;
  name: string;
  status: string;
  is_mandatory: boolean;
}

export interface Filters {
  trilha?: string;
  area?: string;
  cargo?: string;
  nivel?: string;
  supervisor?: string;
  situacao?: Situacao;
  /** Admissão a partir de / até (AAAA-MM-DD). */
  de?: string;
  ate?: string;
  /** Dias sem atividade para considerar a matrícula parada. */
  parado: number;
}

const UUID = /^[0-9a-f-]{36}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Lê os filtros da URL, descartando valores inválidos. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const one = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : undefined;
  };
  const id = (k: string) => (UUID.test(one(k) ?? "") ? one(k) : undefined);
  const day = (k: string) => (DAY.test(one(k) ?? "") ? one(k) : undefined);
  const sit = one("situacao");
  const parado = Number(one("parado"));
  return {
    trilha: id("trilha"),
    area: id("area"),
    cargo: id("cargo"),
    nivel: id("nivel"),
    supervisor: id("supervisor"),
    situacao: sit && sit in SITUACAO_LABEL ? (sit as Situacao) : undefined,
    de: day("de"),
    ate: day("ate"),
    parado: (PARADO_OPCOES as readonly number[]).includes(parado) ? parado : PARADO_PADRAO,
  };
}

export function situacaoOf(e: Pick<EnrollmentRow, "status" | "due_date">, today: string): Situacao {
  if (e.status !== "concluida" && e.due_date && e.due_date < today) return "atrasada";
  return e.status;
}

/** Dias inteiros entre uma data/hora e hoje (AAAA-MM-DD, horário de Brasília). */
export function daysSince(iso: string | null | undefined, today: string): number | null {
  if (!iso) return null;
  const from = Date.parse(`${iso.slice(0, 10)}T12:00:00Z`);
  const to = Date.parse(`${today}T12:00:00Z`);
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

/**
 * Matrícula parada: não concluída e sem estudo na trilha há `dias` ou mais.
 * Sem nenhum estudo, conta a partir da data da matrícula.
 */
export function isParada(e: EnrollmentRow, lastActivity: string | null, today: string, dias: number): boolean {
  if (e.status === "concluida") return false;
  const d = daysSince(lastActivity ?? e.assigned_at, today);
  return d !== null && d >= dias;
}

/** Aplica os filtros de pessoa, trilha e situação. */
export function applyFilters(
  rows: EnrollmentRow[],
  people: Map<string, PersonInfo>,
  f: Filters,
  today: string,
): EnrollmentRow[] {
  return rows.filter((e) => {
    const p = people.get(e.profile_id);
    if (!p) return false;
    if (f.trilha && e.track_id !== f.trilha) return false;
    if (f.area && p.area_id !== f.area) return false;
    if (f.cargo && p.position_id !== f.cargo) return false;
    if (f.nivel && p.level_id !== f.nivel) return false;
    if (f.supervisor && p.supervisor_id !== f.supervisor) return false;
    if (f.de && (!p.admission_date || p.admission_date < f.de)) return false;
    if (f.ate && (!p.admission_date || p.admission_date > f.ate)) return false;
    if (f.situacao) {
      const s = situacaoOf(e, today);
      // "Em andamento" e "Não iniciada" mostram também as atrasadas desse estado.
      if (f.situacao === "atrasada" ? s !== "atrasada" : e.status !== f.situacao) return false;
    }
    return true;
  });
}

export interface Summary {
  matriculas: number;
  pessoas: number;
  naoIniciadas: number;
  emAndamento: number;
  concluidas: number;
  atrasadas: number;
  /** Média do % de conclusão das matrículas. */
  media: number;
}

export function summarize(rows: EnrollmentRow[], today: string): Summary {
  const s: Summary = { matriculas: rows.length, pessoas: new Set(rows.map((r) => r.profile_id)).size, naoIniciadas: 0, emAndamento: 0, concluidas: 0, atrasadas: 0, media: 0 };
  let total = 0;
  for (const r of rows) {
    if (r.status === "nao_iniciada") s.naoIniciadas++;
    else if (r.status === "em_andamento") s.emAndamento++;
    else s.concluidas++;
    if (situacaoOf(r, today) === "atrasada") s.atrasadas++;
    total += Number(r.progress_percent);
  }
  s.media = rows.length ? Math.round(total / rows.length) : 0;
  return s;
}

export interface PersonRow {
  person: PersonInfo;
  trilhas: { id: string; name: string; situacao: Situacao; percent: number }[];
  /** Média do % das trilhas filtradas. */
  percent: number;
  concluidas: number;
  atrasadas: number;
  paradas: number;
  /** Prazo mais próximo entre as trilhas não concluídas. */
  proximoPrazo: string | null;
  ultimaAtividade: string | null;
  segundos: number;
}

export function byPerson(
  rows: EnrollmentRow[],
  people: Map<string, PersonInfo>,
  tracks: Map<string, TrackInfo>,
  activity: Map<string, string>,
  seconds: Map<string, number>,
  lastByPerson: Map<string, string>,
  today: string,
  dias: number,
): PersonRow[] {
  const map = new Map<string, PersonRow>();
  for (const e of rows) {
    const person = people.get(e.profile_id);
    if (!person) continue;
    let row = map.get(e.profile_id);
    if (!row) {
      row = { person, trilhas: [], percent: 0, concluidas: 0, atrasadas: 0, paradas: 0, proximoPrazo: null, ultimaAtividade: lastByPerson.get(e.profile_id) ?? person.last_access_at, segundos: seconds.get(e.profile_id) ?? 0 };
      map.set(e.profile_id, row);
    }
    const situacao = situacaoOf(e, today);
    row.trilhas.push({ id: e.track_id, name: tracks.get(e.track_id)?.name ?? "Trilha", situacao, percent: Math.round(Number(e.progress_percent)) });
    if (e.status === "concluida") row.concluidas++;
    if (situacao === "atrasada") row.atrasadas++;
    if (isParada(e, activity.get(`${e.profile_id}|${e.track_id}`) ?? null, today, dias)) row.paradas++;
    if (e.status !== "concluida" && e.due_date && (!row.proximoPrazo || e.due_date < row.proximoPrazo)) row.proximoPrazo = e.due_date;
  }
  for (const r of map.values()) {
    r.percent = Math.round(r.trilhas.reduce((s, t) => s + t.percent, 0) / r.trilhas.length);
    r.trilhas.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }
  // Quem precisa de atenção primeiro; depois por nome.
  return [...map.values()].sort(
    (a, b) => b.atrasadas - a.atrasadas || b.paradas - a.paradas || a.person.full_name.localeCompare(b.person.full_name, "pt-BR"),
  );
}

export interface TrackRow {
  track: TrackInfo;
  matriculas: number;
  naoIniciadas: number;
  emAndamento: number;
  concluidas: number;
  atrasadas: number;
  paradas: number;
  media: number;
}

export function byTrack(
  rows: EnrollmentRow[],
  tracks: Map<string, TrackInfo>,
  activity: Map<string, string>,
  today: string,
  dias: number,
): TrackRow[] {
  const map = new Map<string, TrackRow & { soma: number }>();
  for (const e of rows) {
    const track = tracks.get(e.track_id);
    if (!track) continue;
    let r = map.get(e.track_id);
    if (!r) {
      r = { track, matriculas: 0, naoIniciadas: 0, emAndamento: 0, concluidas: 0, atrasadas: 0, paradas: 0, media: 0, soma: 0 };
      map.set(e.track_id, r);
    }
    r.matriculas++;
    r.soma += Number(e.progress_percent);
    if (e.status === "nao_iniciada") r.naoIniciadas++;
    else if (e.status === "em_andamento") r.emAndamento++;
    else r.concluidas++;
    if (situacaoOf(e, today) === "atrasada") r.atrasadas++;
    if (isParada(e, activity.get(`${e.profile_id}|${e.track_id}`) ?? null, today, dias)) r.paradas++;
  }
  return [...map.values()]
    .map(({ soma, ...r }) => ({ ...r, media: Math.round(soma / r.matriculas) }))
    .sort((a, b) => b.atrasadas - a.atrasadas || a.track.name.localeCompare(b.track.name, "pt-BR"));
}

export interface AttentionRow {
  enrollment: EnrollmentRow;
  person: PersonInfo;
  track: TrackInfo;
  atrasada: boolean;
  parada: boolean;
  ultimaAtividade: string | null;
  diasSemAtividade: number | null;
}

/** Matrículas que pedem ação: prazo vencido ou sem estudo há `dias`. */
export function attention(
  rows: EnrollmentRow[],
  people: Map<string, PersonInfo>,
  tracks: Map<string, TrackInfo>,
  activity: Map<string, string>,
  today: string,
  dias: number,
): AttentionRow[] {
  const out: AttentionRow[] = [];
  for (const e of rows) {
    const person = people.get(e.profile_id);
    const track = tracks.get(e.track_id);
    if (!person || !track) continue;
    const last = activity.get(`${e.profile_id}|${e.track_id}`) ?? null;
    const atrasada = situacaoOf(e, today) === "atrasada";
    const parada = isParada(e, last, today, dias);
    if (!atrasada && !parada) continue;
    out.push({ enrollment: e, person, track, atrasada, parada, ultimaAtividade: last, diasSemAtividade: daysSince(last ?? e.assigned_at, today) });
  }
  // Atrasadas primeiro (prazo mais antigo antes), depois as paradas há mais tempo.
  return out.sort(
    (a, b) =>
      Number(b.atrasada) - Number(a.atrasada) ||
      (a.enrollment.due_date ?? "9999").localeCompare(b.enrollment.due_date ?? "9999") ||
      (b.diasSemAtividade ?? 0) - (a.diasSemAtividade ?? 0),
  );
}

/** Etapas de uma trilha com quantas pessoas concluíram cada uma (onde param). */
export interface StepRow {
  contentId: string;
  title: string;
  moduleTitle: string;
  required: boolean;
  concluiram: number;
}

export function funnel(
  steps: { contentId: string; title: string; moduleTitle: string; required: boolean }[],
  enrolled: string[],
  completed: Set<string>,
): StepRow[] {
  return steps.map((s) => ({ ...s, concluiram: enrolled.filter((p) => completed.has(`${p}|${s.contentId}`)).length }));
}

/** Tempo em horas e minutos ("2 h 05 min", "12 min", "—"). */
export function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${Math.max(1, m)} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}
