import { createClient } from "@/lib/supabase/server";
import type { EnrollmentStatus } from "@/lib/learning";

export interface MyEnrollment {
  id: string;
  status: EnrollmentStatus;
  progress_percent: number;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  track: { id: string; name: string; description: string | null; is_mandatory: boolean; status: string };
}

/** Matrículas de uma pessoa (a própria ou alguém que ela acompanha; o banco decide). */
export async function loadEnrollmentsOf(profileId: string): Promise<MyEnrollment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("id, status, progress_percent, due_date, started_at, completed_at, track:tracks(id, name, description, is_mandatory, status)")
    .eq("profile_id", profileId)
    .order("assigned_at", { ascending: true });
  return ((data ?? []) as unknown as MyEnrollment[]).filter((e) => e.track && e.track.status !== "rascunho");
}

/** Conteúdos concluídos e tempo ativo por conteúdo de uma pessoa. */
export async function loadProgressOf(profileId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("content_progress")
    .select("content_id, status, active_seconds, session_seconds, visits, completed_at, completion_mode")
    .eq("profile_id", profileId);
  const rows = (data ?? []) as {
    content_id: string;
    status: "em_andamento" | "concluido";
    active_seconds: number;
    session_seconds: number;
    visits: number;
    completed_at: string | null;
    completion_mode: string | null;
  }[];
  return {
    rows,
    completed: new Set(rows.filter((r) => r.status === "concluido").map((r) => r.content_id)),
    byContent: new Map(rows.map((r) => [r.content_id, r])),
  };
}
