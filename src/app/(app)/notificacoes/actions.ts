"use server";

import { getCurrentUser } from "@/lib/auth";
import type { NotificationItem } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

const COLUMNS = "id, kind, title, body, link, created_at, read_at";

/** Avisos recentes para o sininho (gera antes os avisos de prazo do dia). */
export async function loadInbox(): Promise<{ unread: number; items: NotificationItem[] }> {
  const me = await getCurrentUser();
  if (!me?.profile) return { unread: 0, items: [] };
  const supabase = await createClient();
  await supabase.rpc("sync_my_notifications");
  const [{ data }, { count }] = await Promise.all([
    supabase.from("notifications").select(COLUMNS).eq("profile_id", me.userId).order("created_at", { ascending: false }).limit(8),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("profile_id", me.userId).is("read_at", null),
  ]);
  return { unread: count ?? 0, items: (data ?? []) as NotificationItem[] };
}

/** Marca como lidos os avisos informados (ou todos). */
export async function markRead(ids?: string[]): Promise<number> {
  const clean = ids?.filter((i) => /^[0-9a-f-]{36}$/i.test(i));
  if (ids && !clean?.length) return 0;
  const supabase = await createClient();
  const { data } = await supabase.rpc("mark_notifications_read", { p_ids: clean ?? null });
  return Number(data ?? 0);
}
