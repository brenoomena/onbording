import "server-only";
import type { MyGamification } from "@/lib/gamification";
import { createClient } from "@/lib/supabase/server";

export async function loadMyGamification(): Promise<MyGamification | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_gamification");
  return (data as MyGamification | null) ?? null;
}
