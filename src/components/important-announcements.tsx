import { Megaphone } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/** Comunicados importantes ainda não lidos, em destaque no Painel. */
export async function ImportantAnnouncements({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, announcement:announcements!inner(id, title, importance, status)")
    .eq("profile_id", userId)
    .eq("kind", "comunicado")
    .is("read_at", null)
    .eq("announcement.importance", "importante")
    .eq("announcement.status", "publicado")
    .order("created_at", { ascending: false })
    .limit(3);
  const items = ((data ?? []) as unknown as { id: string; announcement: { id: string; title: string } }[]).filter((x) => x.announcement);
  if (!items.length) return null;
  return (
    <section aria-label="Comunicados importantes" className="grid gap-2 rounded-xl border border-tag-orange/30 bg-tag-orange-soft/60 p-4">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-heading">
        <Megaphone size={16} aria-hidden className="text-tag-orange" /> {items.length === 1 ? "Comunicado importante" : "Comunicados importantes"}
      </p>
      <ul className="grid gap-1">
        {items.map((x) => (
          <li key={x.id}>
            <Link href={`/comunicados/${x.announcement.id}`} className="text-[14px] font-medium text-accent hover:underline">
              {x.announcement.title} →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
