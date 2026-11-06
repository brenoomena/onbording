"use client";

import { ExternalLink, GripVertical, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NoticeDialog } from "@/components/forms";
import { TabsContext, type TabsApi } from "@/components/tabs";
import { cx } from "@/components/ui";
import { reorderModule } from "../actions";

export interface WorkspaceSection {
  key: string;
  label: string;
  /** "trilha": Visão geral, Dados…; "modulo": um módulo da trilha. */
  group: "trilha" | "modulo";
  icon?: ReactNode;
  count?: number;
  /** Item do menu que é um link para outra página (ex.: Matrículas). */
  href?: string;
  /** Não aparece no menu (ex.: formulário de novo módulo). */
  hidden?: boolean;
  moduleId?: string;
  content?: ReactNode;
}

export interface WorkspacePanel {
  key: string;
  label: string;
  content: ReactNode;
}

/** Botão que leva a outra parte do editor (ou abre um painel ao lado). */
export function GoButton({ to, data, className, children, label }: { to: string; data?: Record<string, string>; className?: string; children: ReactNode; label?: string }) {
  const ws = useWorkspace();
  if (!ws) return null;
  return (
    <button type="button" aria-label={label} onClick={() => ws.go(to, data)} className={className}>
      {children}
    </button>
  );
}

// O editor reaproveita o contexto das abas: os formulários (novo módulo,
// novo conteúdo, nova avaliação) funcionam igual nos dois lugares.
function useWorkspace(): TabsApi | null {
  return useContext(TabsContext);
}

const navItem = "flex w-full min-h-[40px] items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13.5px] transition-colors";
const navOn = "bg-accent-soft font-semibold text-heading shadow-[inset_2px_0_0_rgb(var(--brand))]";
const navOff = "font-medium text-ink hover:bg-sunken";

/**
 * Editor da trilha em página inteira: menu à esquerda (trilha e módulos, com
 * arrastar para ordenar) e a parte escolhida ao lado. Os painéis de novo
 * conteúdo e nova avaliação abrem à direita do módulo.
 */
export function TrackWorkspace({
  trackId,
  sections,
  panels,
  initial,
  initialPanel,
  canEdit,
}: {
  trackId: string;
  sections: WorkspaceSection[];
  panels: WorkspacePanel[];
  initial?: string;
  initialPanel?: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const valid = (k?: string) => (k && sections.some((s) => s.key === k && s.content) ? k : undefined);
  const [active, setActive] = useState(() => valid(initial) ?? sections.find((s) => s.content)?.key ?? "");
  const [panel, setPanel] = useState<string | null>(() => (initialPanel && panels.some((p) => p.key === initialPanel) ? initialPanel : null));
  const [data, setData] = useState<Record<string, string>>({});
  const [nonce, setNonce] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<{ tone: "ok" | "danger"; message: string } | null>(null);
  const [selectNew, setSelectNew] = useState(false);
  const known = useRef<string[]>([]);
  const top = useRef<HTMLDivElement>(null);

  const modules = sections.filter((s) => s.group === "modulo");
  const signature = modules.map((m) => m.key).join(",");
  const current = sections.find((s) => s.key === active && s.content) ?? sections.find((s) => s.content);
  const isModule = current?.group === "modulo";

  // Módulos que já existiam quando "Novo módulo" foi aberto: o que aparecer
  // depois de salvar é o recém-criado, e ele é aberto em seguida.
  useEffect(() => {
    if (active === "modulo") known.current = signature.split(",").filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  useEffect(() => {
    if (!selectNew) return;
    const created = signature.split(",").find((k) => k && !known.current.includes(k));
    if (created) {
      setActive(created);
      setSelectNew(false);
    }
  }, [signature, selectNew]);

  // A parte aberta fica no endereço: recarregar a página volta para ela.
  useEffect(() => {
    if (!current) return;
    const url = new URL(window.location.href);
    url.searchParams.set("parte", current.key);
    if (panel) url.searchParams.set("painel", panel);
    else url.searchParams.delete("painel");
    url.searchParams.delete("aba");
    url.searchParams.delete("aviso");
    window.history.replaceState(window.history.state, "", url);
  }, [current, panel]);

  const scrollTop = () => requestAnimationFrame(() => top.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));

  const go = useCallback(
    (key: string, d?: Record<string, string>) => {
      if (panels.some((p) => p.key === key)) {
        setPanel(key);
        setData(d ?? {});
        if (d?.moduleId) setActive(`m-${d.moduleId}`);
        scrollTop();
        return;
      }
      if (key === "estrutura") {
        // Depois de salvar: fecha o painel; um módulo novo é aberto em seguida.
        setPanel(null);
        setData({});
        if (active === "modulo") setSelectNew(true);
        return;
      }
      const target = sections.find((s) => s.key === key);
      if (!target?.content) return;
      setActive(key);
      // Trocar de módulo com o painel aberto: o painel acompanha o módulo.
      if (panel && target.group === "modulo" && target.moduleId) setData((old) => ({ ...old, moduleId: target.moduleId! }));
      else setPanel(null);
      scrollTop();
    },
    [panels, sections, active, panel],
  );
  const reset = useCallback((key: string) => setNonce((n) => ({ ...n, [key]: (n[key] ?? 0) + 1 })), []);
  const notify = useCallback((message: string) => setNotice({ tone: "ok", message }), []);
  const api = useMemo<TabsApi>(() => ({ active: panel ?? active, go, data, reset, notify }), [panel, active, go, data, reset, notify]);

  // ---------------------------------------------------- arrastar módulos
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  useEffect(() => setOrder(null), [signature]);
  const ordered = (order ?? modules.map((m) => m.key)).map((k) => modules.find((m) => m.key === k)).filter(Boolean) as WorkspaceSection[];

  const drop = (targetKey: string) => {
    const from = ordered.findIndex((m) => m.key === dragging);
    const to = ordered.findIndex((m) => m.key === targetKey);
    setDragging(null);
    setOver(null);
    if (from < 0 || to < 0 || from === to) return;
    const moved = ordered[from];
    const next = ordered.map((m) => m.key);
    next.splice(from, 1);
    next.splice(to, 0, moved.key);
    setOrder(next);
    const fd = new FormData();
    fd.set("id", moved.moduleId!);
    fd.set("steps", String(to - from));
    fd.set("track_id", trackId);
    startTransition(async () => {
      const res = await reorderModule({}, fd);
      if (res.error) {
        setOrder(null);
        setNotice({ tone: "danger", message: res.error });
      }
      router.refresh();
    });
  };

  const trilha = sections.filter((s) => s.group === "trilha" && !s.hidden);
  const currentPanel = panels.find((p) => p.key === panel);
  const panelModule = data.moduleId ? modules.find((m) => m.moduleId === data.moduleId) : undefined;
  const sideBySide = !!currentPanel && isModule;

  const navButton = (s: WorkspaceSection, extra?: ReactNode, number?: number) => {
    const on = current?.key === s.key;
    return (
      <button type="button" onClick={() => go(s.key)} aria-current={on ? "true" : undefined} className={cx(navItem, on ? navOn : navOff)}>
        {extra}
        {number !== undefined ? (
          <span
            aria-hidden
            className={cx(
              "grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11.5px] font-semibold tabular-nums",
              on ? "bg-brand text-white" : "bg-sunken text-muted",
            )}
          >
            {number}
          </span>
        ) : (
          <span className={cx("shrink-0", on ? "text-icon" : "text-muted")}>{s.icon}</span>
        )}
        <span className="min-w-0 flex-1 truncate">{s.label}</span>
        {s.count !== undefined && <span className="shrink-0 text-[12px] tabular-nums text-muted">{s.count}</span>}
      </button>
    );
  };

  return (
    <TabsContext.Provider value={api}>
      {notice && <NoticeDialog tone={notice.tone} message={notice.message} onClose={() => setNotice(null)} />}
      <div ref={top} className="grid scroll-mt-24 gap-5 lg:grid-cols-[264px_minmax(0,1fr)] lg:items-start">
        <aside aria-label="Partes da trilha" className="hidden rounded-2xl border border-line bg-surface p-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] lg:sticky lg:top-[84px] lg:block lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto">
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">Trilha</p>
          <ul className="grid gap-0.5">
            {trilha.map((s) => (
              <li key={s.key}>
                {s.href ? (
                  <a href={s.href} className={cx(navItem, navOff)}>
                    <span className="shrink-0 text-muted">{s.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    {s.count !== undefined && <span className="text-[12px] tabular-nums text-muted">{s.count}</span>}
                    <ExternalLink size={13} aria-hidden className="text-muted" />
                  </a>
                ) : (
                  navButton(s)
                )}
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-baseline justify-between gap-2 px-2.5 pb-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">Módulos · {modules.length}</p>
            {canEdit && modules.length > 1 && <span className="text-[11px] text-muted">arraste para ordenar</span>}
          </div>
          {modules.length === 0 && <p className="px-2.5 py-1 text-[12.5px] text-muted">Nenhum módulo ainda.</p>}
          <ol className="grid gap-0.5" aria-label="Módulos">
            {ordered.map((m, i) => (
              <li
                key={m.key}
                draggable={canEdit && ordered.length > 1}
                onDragStart={(e) => {
                  setDragging(m.key);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", m.key);
                }}
                onDragOver={(e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  setOver(m.key);
                }}
                onDragLeave={() => setOver((o) => (o === m.key ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  drop(m.key);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
                className={cx("rounded-lg", dragging === m.key && "opacity-50", over === m.key && dragging !== m.key && "ring-2 ring-brand/60")}
              >
                {navButton(
                  m,
                  canEdit && ordered.length > 1 ? <GripVertical size={14} aria-hidden className="-ml-1 shrink-0 cursor-grab text-muted/70" /> : undefined,
                  i + 1,
                )}
              </li>
            ))}
          </ol>
          {canEdit && (
            <button
              type="button"
              onClick={() => go("modulo")}
              aria-current={current?.key === "modulo" ? "true" : undefined}
              className={cx(
                "mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-dashed text-[13.5px] font-semibold transition-colors",
                current?.key === "modulo" ? "border-brand bg-accent-soft text-heading" : "border-line bg-bg/60 text-accent hover:border-brand",
              )}
            >
              <Plus size={16} aria-hidden /> Novo módulo
            </button>
          )}
        </aside>

        <div className="grid min-w-0 gap-4">
          <label className="grid gap-1 lg:hidden">
            <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">Você está editando</span>
            <select
              value={current?.key ?? ""}
              onChange={(e) => {
                const s = sections.find((x) => x.key === e.target.value);
                if (s?.href) router.push(s.href);
                else go(e.target.value);
              }}
              className="h-11 rounded-lg border border-accent/30 bg-accent-soft px-3 text-[15px] font-semibold text-heading"
            >
              {trilha.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                  {s.count !== undefined ? ` (${s.count})` : ""}
                </option>
              ))}
              {ordered.map((m, i) => (
                <option key={m.key} value={m.key}>
                  {i + 1} · {m.label}
                </option>
              ))}
              {canEdit && <option value="modulo">+ Novo módulo</option>}
            </select>
          </label>

          <div className={cx("grid min-w-0 items-start gap-5", sideBySide && "xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
            <div className={cx("grid min-w-0 gap-4", currentPanel && !isModule && "hidden")}>
              {sections.map((s) =>
                s.content ? (
                  <div key={`${s.key}-${nonce[s.key] ?? 0}`} hidden={s.key !== current?.key} className={cx("grid gap-4 [&>*]:min-w-0", s.key !== current?.key && "!hidden")}>
                    {s.content}
                  </div>
                ) : null,
              )}
            </div>

            {panels.map((p) => (
              <section
                key={`${p.key}-${nonce[p.key] ?? 0}`}
                aria-label={p.label}
                hidden={p.key !== panel}
                className={cx(
                  "min-w-0 rounded-2xl border border-accent/30 bg-surface shadow-[0_12px_32px_-18px_rgba(15,30,51,0.45)] xl:sticky xl:top-[84px]",
                  p.key !== panel && "!hidden",
                )}
              >
                <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold text-heading">{p.label}</h2>
                    {panelModule && <p className="mt-0.5 truncate text-[12.5px] text-muted">em {panelModule.label}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPanel(null);
                      setData({});
                    }}
                    aria-label="Fechar painel"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sunken text-ink hover:bg-line"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
                <div className="grid gap-4 p-5 [&>*]:min-w-0">{p.content}</div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </TabsContext.Provider>
  );
}
