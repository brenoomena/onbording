import { createClient } from "@/lib/supabase/server";
import type { PersonOption } from "@/lib/queries";

/** Pessoas que podem ser responsáveis por conteúdos e categorias já usadas. */
export async function loadContentFormData(): Promise<{ owners: PersonOption[]; categories: string[] }> {
  const supabase = await createClient();
  const [{ data: people }, { data: cats }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").neq("status", "inativo").order("full_name"),
    supabase.from("contents").select("category").not("category", "is", null),
  ]);
  return {
    owners: (people ?? []) as PersonOption[],
    categories: [...new Set((cats ?? []).map((c) => c.category as string))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}
