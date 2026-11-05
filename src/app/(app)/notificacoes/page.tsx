import { Bell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { KIND_CLASS, KIND_ICON } from "@/components/notification-bell";
import { Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { NOTIFICATION_LABEL, safeLink, timeAgo, type NotificationItem } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { ReadAllButton, ReadOnClick } from "./read-buttons";

export const metadata: Metadata = { title: "Avisos" };

export default async function NotificacoesPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const me = await requireUser();
  const { filtro } = await searchParams;
  const onlyUnread = filtro === "nao-lidos";
  const supabase = await createClient();
  await supabase.rpc("sync_my_notifications");
  let q = supabase.from("notifications").select("id, kind, title, body, link, created_at, read_at").eq("profile_id", me.userId).order("created_at", { ascending: false }).limit(100);
  if (onlyUnread) q = q.is("read_at", null);
  const [{ data }, { count }] = await Promise.all([q, supabase.from("notifications").select("id", { count: "exact", head: true }).eq("profile_id", me.userId).is("read_at", null)]);
  const items = (data ?? []) as NotificationItem[];
  const unread = count ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Comunicação"
        icon={Bell}
        title="Avisos"
        description="Matrículas, prazos, correções, certificados e comunicados. Os últimos 100 ficam aqui."
        actions={unread > 0 ? <ReadAllButton /> : undefined}
      />
      <div role="tablist" aria-label="Filtro" className="flex gap-1.5">
        {[
          ["todos", "Todos", !onlyUnread],
          ["nao-lidos", `Não lidos${unread ? ` (${unread})` : ""}`, onlyUnread],
        ].map(([key, label, active]) => (
          <Link
            key={String(key)}
            href={key === "todos" ? "/notificacoes" : "/notificacoes?filtro=nao-lidos"}
            role="tab"
            aria-selected={!!active}
            className={cx("rounded-lg border px-3 py-1.5 text-[13px] font-medium", active ? "border-accent/30 bg-accent-soft text-accent" : "border-line bg-surface text-muted hover:text-ink")}
          >
            {label}
          </Link>
        ))}
      </div>
      <Card flush>
        {items.length === 0 ? (
          <EmptyState icon={Bell} title={onlyUnread ? "Tudo lido" : "Nenhum aviso ainda"}>
            {onlyUnread ? "Você não tem avisos pendentes." : "Quando houver matrícula, prazo, correção ou comunicado, o aviso aparece aqui e no sininho."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => {
              const Icon = KIND_ICON[n.kind] ?? Bell;
              const link = safeLink(n.link);
              return (
                <li key={n.id}>
                  <ReadOnClick id={n.id} unread={!n.read_at} href={link}>
                    <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg", KIND_CLASS[n.kind])}>
                      <Icon size={17} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className={cx("text-[14px] text-heading", !n.read_at && "font-semibold")}>{n.title}</span>
                        <span className="text-[12px] text-muted">{timeAgo(n.created_at)}</span>
                      </span>
                      {n.body && <span className="block text-[13px] text-muted">{n.body}</span>}
                      <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-muted/80">{NOTIFICATION_LABEL[n.kind]}</span>
                    </span>
                    {!n.read_at && <span aria-label="Não lido" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                  </ReadOnClick>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
