import { CalendarDays, Medal, Sparkles, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { BadgeIcon } from "@/components/badge-icon";
import { Card, EmptyState, PageHeader, StatCard, cx, formatDate } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { POINTS_RULES, REASON_LABEL, formatPoints, type Badge, type RankingRow } from "@/lib/gamification";
import { loadMyGamification } from "@/lib/gamification-server";
import { P } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { AreaPicker } from "./area-picker";

export const metadata: Metadata = { title: "Conquistas" };

export default async function ConquistasPage({ searchParams }: { searchParams: Promise<{ periodo?: string; area?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const month = sp.periodo !== "total";
  const seesAll = can(me, P.progressoVer) || can(me, P.equipeVer);
  const area = seesAll && sp.area && /^[0-9a-f-]{36}$/i.test(sp.area) ? sp.area : null;
  const supabase = await createClient();

  const [mine, { data: catalog }, { data: earned }, { data: ranking }, { data: history }, { data: areas }] = await Promise.all([
    loadMyGamification(),
    supabase.from("badges").select("*").order("sort_order"),
    supabase.from("user_badges").select("badge_key, earned_at").eq("profile_id", me.userId),
    supabase.rpc("points_ranking", { p_area: area, p_month: month }),
    supabase.from("points_ledger").select("id, points, reason, description, created_at").eq("profile_id", me.userId).order("created_at", { ascending: false }).limit(15),
    seesAll ? supabase.from("areas").select("id, name").eq("active", true).order("name") : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const got = new Map(((earned ?? []) as { badge_key: string; earned_at: string }[]).map((b) => [b.badge_key, b.earned_at]));
  const rows = (ranking ?? []) as RankingRow[];
  const myArea = me.profile.area_id;
  const shownArea = area ?? myArea;
  const areaName = rows[0]?.area_name ?? (areas ?? []).find((a) => a.id === shownArea)?.name ?? null;
  const qs = (p: Record<string, string | null>) => {
    const u = new URLSearchParams();
    const periodo = p.periodo ?? (month ? null : "total");
    if (periodo) u.set("periodo", periodo);
    const ar = "area" in p ? p.area : area;
    if (ar) u.set("area", ar);
    const s = u.toString();
    return `/conquistas${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader eyebrow="Aprendizagem" icon={Trophy} title="Conquistas" description="Pontos e medalhas ganhos ao estudar, ser aprovado e concluir trilhas." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pontos no mês" value={(mine?.month ?? 0).toLocaleString("pt-BR")} icon={CalendarDays} tone="brand" />
        <StatCard label="Pontos no total" value={(mine?.total ?? 0).toLocaleString("pt-BR")} icon={Sparkles} />
        <StatCard
          label="Posição na área"
          value={mine?.rank_month ? `${mine.rank_month}º` : "—"}
          hint={mine?.area_size ? `de ${mine.area_size} no mês${mine.rank_total ? ` · ${mine.rank_total}º no total` : ""}` : "Sem área definida"}
          icon={Trophy}
          tone="ok"
        />
        <StatCard label="Medalhas" value={`${mine?.badges ?? 0} de ${mine?.badges_total ?? (catalog ?? []).length}`} icon={Medal} />
      </div>

      <Card title="Medalhas" description="As conquistadas aparecem coloridas. Passe o olho nas que faltam para saber como ganhar." icon={Medal}>
        <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
          {((catalog ?? []) as Badge[]).map((b) => {
            const at = got.get(b.key);
            return (
              <li key={b.key} className={cx("flex items-center gap-3 rounded-xl border p-3", at ? "border-line bg-surface" : "border-dashed border-line bg-sunken/40")}>
                <BadgeIcon icon={b.icon} tone={b.tone} earned={!!at} size={48} />
                <div className="min-w-0">
                  <p className={cx("text-[14px] font-semibold", at ? "text-heading" : "text-muted")}>{b.name}</p>
                  <p className="text-[12px] leading-snug text-muted">{b.description}</p>
                  <p className={cx("mt-0.5 text-[11.5px] font-medium", at ? "text-ok" : "text-muted/80")}>{at ? `Conquistada em ${formatDate(at)}` : "Ainda não conquistada"}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card
          title={`Ranking${areaName ? ` · ${areaName}` : ""}`}
          description={month ? "Pontos ganhos neste mês." : "Pontos desde o início."}
          icon={Trophy}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {seesAll && <AreaPicker areas={areas ?? []} value={shownArea} myArea={myArea} total={!month} />}
              <div role="tablist" aria-label="Período" className="inline-flex rounded-lg border border-line p-0.5">
                {(
                  [
                    [true, "Este mês", qs({ periodo: null })],
                    [false, "Desde o início", qs({ periodo: "total" })],
                  ] as const
                ).map(([m, label, href]) => (
                  <Link key={label} href={href} role="tab" aria-selected={month === m} className={cx("rounded-md px-2.5 py-1 text-[12.5px] font-medium", month === m ? "bg-accent-soft text-accent" : "text-muted hover:text-ink")}>
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          }
          flush
        >
          {rows.length === 0 ? (
            <EmptyState icon={Trophy} title="Sem ranking">
              {shownArea ? "Ninguém desta área pontuou ainda." : "Você ainda não tem área definida no cadastro; o ranking é por área."}
            </EmptyState>
          ) : (
            <ol className="divide-y divide-line">
              {rows.map((r) => {
                const isMe = r.profile_id === me.userId;
                return (
                  <li key={r.profile_id} className={cx("flex items-center gap-3 px-5 py-2.5", isMe && "bg-accent-soft/40")}>
                    <span
                      className={cx(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12.5px] font-bold tabular-nums",
                        r.points > 0 && r.rank === 1 ? "bg-tag-gold-soft text-tag-gold" : r.points > 0 && r.rank === 2 ? "bg-tag-silver-soft text-tag-silver" : r.points > 0 && r.rank === 3 ? "bg-tag-orange-soft text-tag-orange" : "text-muted",
                      )}
                    >
                      {r.rank}
                    </span>
                    <Avatar name={r.full_name} path={r.avatar_path} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-heading">
                        {r.full_name}
                        {isMe && <span className="ml-1.5 text-[12px] font-semibold text-accent">(você)</span>}
                      </span>
                      <span className="text-[12px] text-muted">
                        {r.badges} {r.badges === 1 ? "medalha" : "medalhas"}
                      </span>
                    </span>
                    <span className="text-[14px] font-semibold tabular-nums text-heading">{r.points.toLocaleString("pt-BR")}</span>
                    <span className="w-10 text-[12px] text-muted">pts</span>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <Card title="Meus últimos pontos" icon={Sparkles} flush>
            {(history ?? []).length === 0 ? (
              <EmptyState icon={Sparkles} title="Nenhum ponto ainda">
                Conclua etapas e avaliações das suas trilhas para começar a pontuar.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {(history ?? []).map((h) => (
                  <li key={h.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] text-heading">{h.description}</span>
                      <span className="text-[12px] text-muted">
                        {REASON_LABEL[h.reason] ?? h.reason} · {formatDate(h.created_at)}
                      </span>
                    </span>
                    <span className="text-[13.5px] font-semibold tabular-nums text-ok">+{h.points}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Como pontuar" icon={Trophy}>
            <ul className="grid gap-1.5 text-[13.5px]">
              {POINTS_RULES.map(([label, pts]) => (
                <li key={label} className="flex justify-between gap-3">
                  <span>{label}</span>
                  <span className="font-semibold tabular-nums">+{formatPoints(pts).replace(" pontos", "")}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-muted">Cada etapa, avaliação e trilha pontua uma vez só. Materiais avulsos da biblioteca não pontuam.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
