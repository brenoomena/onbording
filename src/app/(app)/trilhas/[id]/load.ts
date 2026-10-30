import { createClient } from "@/lib/supabase/server";
import type { TrackModule, TrackRow } from "@/lib/learning";

/** Trilha com módulos e itens em ordem, respeitando o que a pessoa pode ver. */
export async function loadTrack(id: string): Promise<{ track: TrackRow; modules: TrackModule[] } | null> {
  const supabase = await createClient();
  const { data: track } = await supabase.from("tracks").select("*").eq("id", id).maybeSingle();
  if (!track) return null;
  const { data: mods } = await supabase
    .from("modules")
    .select("id, title, description, position, module_items(id, module_id, position, is_required, content:contents(id, title, kind, external_platform, estimated_minutes, status, category))")
    .eq("track_id", id)
    .order("position");
  const modules = ((mods ?? []) as unknown as TrackModule[] & { module_items: TrackModule["items"] }[]).map((m) => {
    const raw = m as unknown as TrackModule & { module_items: TrackModule["items"] };
    return {
      id: raw.id,
      title: raw.title,
      description: raw.description,
      position: raw.position,
      items: [...raw.module_items].filter((i) => i.content).sort((a, b) => a.position - b.position),
    };
  });
  return { track: track as TrackRow, modules };
}
