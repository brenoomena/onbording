"use client";

import { Award, Bell, BellRing, CalendarClock, CalendarX2, CheckCheck, ClipboardCheck, ClipboardPen, Medal, Megaphone, Route, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { NOTIFICATION_LABEL, safeLink, timeAgo, type NotificationItem, type NotificationKind } from "@/lib/notifications";
import { loadInbox, markRead } from "@/app/(app)/notificacoes/actions";

export const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  matricula: Route,
  prazo_proximo: CalendarClock,
  prazo_vencido: CalendarX2,
  correcao_pendente: ClipboardPen,
  avaliacao_corrigida: ClipboardCheck,
  certificado: Award,
  comunicado: Megaphone,
  medalha: Medal,
};

export const KIND_CLASS: Record<NotificationKind, string> = {
  matricula: "bg-tag-blue-soft text-tag-blue",
  prazo_proximo: "bg-warn-soft text-warn",
  prazo_vencido: "bg-danger-soft text-danger",
  correcao_pendente: "bg-tag-violet-soft text-tag-violet",
  avaliacao_corrigida: "bg-tag-teal-soft text-tag-teal",
  certificado: "bg-ok-soft text-ok",
  comunicado: "bg-tag-orange-soft text-tag-orange",
  medalha: "bg-tag-gold-soft text-tag-gold",
};

/** Sininho do topo: avisos recentes, contador de não lidos e atalho para todos. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ unread: number; items: NotificationItem[] } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const panelId = useId();

  const refresh = useCallback(() => {
    loadInbox()
      .then(setData)
      .catch(() => {});
  }, []);

  // Atualiza ao trocar de página e a cada minuto (só com a aba visível).
  useEffect(() => {
    setOpen(false);
    refresh();
  }, [pathname, refresh]);
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = data?.unread ?? 0;

  async function openItem(n: NotificationItem) {
    setOpen(false);
    if (!n.read_at) {
      setData((d) => d && { unread: Math.max(0, d.unread - 1), items: d.items.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)) });
      void markRead([n.id]);
    }
    const link = safeLink(n.link);
    if (link) router.push(link);
  }

  async function readAll() {
    setData((d) => d && { unread: 0, items: d.items.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })) });
    await markRead();
    refresh();
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unread ? `Avisos: ${unread} não ${unread === 1 ? "lido" : "lidos"}` : "Avisos"}
        className={cx("relative grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink", open && "bg-sunken text-ink")}
      >
        {unread ? <BellRing size={19} aria-hidden /> : <Bell size={19} aria-hidden />}
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10.5px] font-bold leading-[18px] text-white ring-2 ring-surface">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Avisos"
          className="absolute right-0 top-full z-30 mt-1 w-[380px] overflow-hidden rounded-xl border border-line bg-surface shadow-[0_12px_32px_rgba(0,0,0,0.16)] max-sm:fixed max-sm:inset-x-3 max-sm:top-[64px] max-sm:mt-0 max-sm:w-auto"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <p className="text-[14px] font-semibold text-heading">Avisos</p>
            {unread > 0 && (
              <button type="button" onClick={readAll} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-medium text-accent hover:bg-accent-soft">
                <CheckCheck size={14} aria-hidden /> Marcar todos como lidos
              </button>
            )}
          </div>
          {!data ? (
            <p className="px-4 py-6 text-center text-[13px] text-muted">Carregando…</p>
          ) : data.items.length === 0 ? (
            <div className="grid justify-items-center gap-2 px-4 py-8 text-center">
              <Bell size={22} aria-hidden className="text-muted" />
              <p className="text-[13px] text-muted">Nenhum aviso por enquanto.</p>
            </div>
          ) : (
            <ul className="max-h-[min(70vh,440px)] divide-y divide-line overflow-y-auto">
              {data.items.map((n) => {
                const Icon = KIND_ICON[n.kind] ?? Bell;
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => openItem(n)} className={cx("flex w-full gap-3 px-4 py-3 text-left hover:bg-sunken", !n.read_at && "bg-accent-soft/35")}>
                      <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg", KIND_CLASS[n.kind])}>
                        <Icon size={16} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cx("truncate text-[13.5px] text-heading", !n.read_at && "font-semibold")}>{n.title}</span>
                          <span className="shrink-0 text-[11px] text-muted">{timeAgo(n.created_at)}</span>
                        </span>
                        {n.body && <span className="line-clamp-2 text-[12.5px] text-muted">{n.body}</span>}
                        <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-muted/80">{NOTIFICATION_LABEL[n.kind]}</span>
                      </span>
                      {!n.read_at && <span aria-label="Não lido" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/notificacoes" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-[13px] font-medium text-accent hover:bg-sunken">
            Ver todos os avisos
          </Link>
        </div>
      )}
    </div>
  );
}
