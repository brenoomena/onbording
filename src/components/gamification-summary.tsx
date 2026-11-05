import { Trophy } from "lucide-react";
import Link from "next/link";
import { BadgeIcon } from "@/components/badge-icon";
import { loadMyGamification } from "@/lib/gamification-server";
import { createClient } from "@/lib/supabase/server";

/** Resumo de pontos, posição e medalhas no Painel. */
export async function GamificationSummary({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [mine, { data: recent }] = await Promise.all([
    loadMyGamification(),
    supabase.from("user_badges").select("earned_at, badge:badges(key, name, icon, tone)").eq("profile_id", userId).order("earned_at", { ascending: false }).limit(5),
  ]);
  if (!mine) return null;
  const badges = ((recent ?? []) as unknown as { badge: { key: string; name: string; icon: string; tone: string } | null }[]).filter((b) => b.badge);
  return (
    <section aria-label="Minhas conquistas" className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-line bg-surface px-5 py-4">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-tag-gold-soft text-tag-gold">
        <Trophy size={22} aria-hidden />
      </span>
      <div className="grid gap-0.5">
        <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">Pontos no mês</p>
        <p className="text-[22px] font-semibold leading-none tabular-nums text-heading">{mine.month.toLocaleString("pt-BR")}</p>
      </div>
      <div className="grid gap-0.5">
        <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">Posição na área</p>
        <p className="text-[22px] font-semibold leading-none tabular-nums text-heading">{mine.rank_month ? `${mine.rank_month}º` : "—"}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {badges.length ? (
          badges.map((b) => <BadgeIcon key={b.badge!.key} icon={b.badge!.icon} tone={b.badge!.tone} size={34} label={b.badge!.name} />)
        ) : (
          <span className="text-[13px] text-muted">Nenhuma medalha ainda</span>
        )}
      </div>
      <Link href="/conquistas" className="ml-auto text-[13px] font-medium text-accent hover:underline">
        Ver conquistas →
      </Link>
    </section>
  );
}
