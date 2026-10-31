import { createClient } from "@/lib/supabase/server";
import type { PersonOption } from "@/lib/queries";

/** Pessoas que podem ser responsáveis por conteúdos e categorias já usadas. */
export interface TrackOption {
  id: string;
  name: string;
  status: string;
}

/** Pessoas que podem ser responsáveis por conteúdos, categorias já usadas e trilhas disponíveis. */
export async function loadContentFormData(): Promise<{ owners: PersonOption[]; categories: string[]; tracks: TrackOption[] }> {
  const supabase = await createClient();
  const [{ data: people }, { data: cats }, { data: tracks }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").neq("status", "inativo").order("full_name"),
    supabase.from("contents").select("category").not("category", "is", null),
    supabase.from("tracks").select("id, name, status").neq("status", "arquivado").order("name"),
  ]);
  return {
    tracks: (tracks ?? []) as TrackOption[],
    owners: (people ?? []) as PersonOption[],
    categories: [...new Set((cats ?? []).map((c) => c.category as string))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}
