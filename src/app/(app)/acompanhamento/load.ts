import "server-only";
import { can, type CurrentUser } from "@/lib/auth";
import {
  applyFilters,
  type EnrollmentRow,
  type Filters,
  type PersonInfo,
  type TrackInfo,
} from "@/lib/acompanhamento";
import { P } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

const PAGE = 1000;

/** Lê todas as linhas de uma consulta, em páginas (o Supabase devolve no máximo 1000 por vez). */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const res = await page(from, from + PAGE - 1);
    if (res.error) throw new Error(res.error.message);
    const data = (res.data ?? []) as T[];
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

export interface AcompanhamentoData {
  /** Só a própria equipe (permissão equipe.ver, sem progresso.ver). */
  teamOnly: boolean;
  people: Map<string, PersonInfo>;
  tracks: Map<string, TrackInfo>;
  /** Matrículas já filtradas. */
  rows: EnrollmentRow[];
  /** Última atividade por pessoa+trilha ("perfil|trilha" → data/hora). */
  activity: Map<string, string>;
  /** Último estudo de cada pessoa, em qualquer conteúdo. */
  lastByPerson: Map<string, string>;
  /** Tempo ativo total de estudo por pessoa (segundos). */
  seconds: Map<string, number>;
  /** Conteúdos concluídos ("perfil|conteúdo"). */
  completed: Set<string>;
}

/**
 * Dados do Acompanhamento no alcance de quem consulta: todos (progresso.ver)
 * ou só a própria equipe (equipe.ver). O banco confere de novo (RLS).
 * Fora: pessoas inativas e trilhas arquivadas.
 */
export async function loadAcompanhamento(me: CurrentUser, f: Filters, today: string): Promise<AcompanhamentoData> {
  const supabase = await createClient();
  const teamOnly = !can(me, P.progressoVer);

  const [peopleRows, trackRows, enrollmentRows, progressRows] = await Promise.all([
    all<PersonInfo>((a, b) => {
      let q = supabase
        .from("profiles")
        .select("id, full_name, email, status, area_id, position_id, level_id, supervisor_id, admission_date, last_access_at")
        .neq("status", "inativo")
        .order("id")
        .range(a, b);
      if (teamOnly) q = q.eq("supervisor_id", me.userId);
      return q;
    }),
    all<TrackInfo>((a, b) => supabase.from("tracks").select("id, name, status, is_mandatory").neq("status", "arquivado").order("id").range(a, b)),
    all<EnrollmentRow>((a, b) =>
      supabase
        .from("enrollments")
        .select("id, profile_id, track_id, status, progress_percent, due_date, assigned_at, started_at, completed_at")
        .order("id")
        .range(a, b),
    ),
    all<{ profile_id: string; content_id: string; status: string; active_seconds: number; last_opened_at: string; content: { track_id: string | null } | null }>(
      (a, b) =>
        supabase
          .from("content_progress")
          .select("profile_id, content_id, status, active_seconds, last_opened_at, content:contents(track_id)")
          .order("profile_id")
          .order("content_id")
          .range(a, b),
    ),
  ]);

  const people = new Map(peopleRows.map((p) => [p.id, p]));
  const tracks = new Map(trackRows.map((t) => [t.id, t]));
  const activity = new Map<string, string>();
  const lastByPerson = new Map<string, string>();
  const seconds = new Map<string, number>();
  const completed = new Set<string>();
  for (const r of progressRows) {
    if (!people.has(r.profile_id)) continue;
    seconds.set(r.profile_id, (seconds.get(r.profile_id) ?? 0) + (r.active_seconds ?? 0));
    if ((lastByPerson.get(r.profile_id) ?? "") < r.last_opened_at) lastByPerson.set(r.profile_id, r.last_opened_at);
    if (r.status === "concluido") completed.add(`${r.profile_id}|${r.content_id}`);
    const c = Array.isArray(r.content) ? r.content[0] : r.content;
    const track = c?.track_id;
    if (track) {
      const k = `${r.profile_id}|${track}`;
      if ((activity.get(k) ?? "") < r.last_opened_at) activity.set(k, r.last_opened_at);
    }
  }

  // A própria pessoa fica de fora (como no Painel): aqui se acompanha os outros.
  const inScope = enrollmentRows.filter((e) => tracks.has(e.track_id) && e.profile_id !== me.userId);
  return { teamOnly, people, tracks, rows: applyFilters(inScope, people, f, today), activity, lastByPerson, seconds, completed };
}
