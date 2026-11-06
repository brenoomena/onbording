"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { NoticeDialog } from "@/components/forms";
import { cx } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

export interface TabDef {
  key: string;
  label: string;
  icon?: ReactNode;
  /** Número pequeno ao lado do nome (ex.: quantidade de módulos). */
  count?: number;
  content: ReactNode;
}

export interface TabsApi {
  active: string;
  /** Troca de aba; `data` vai para a aba aberta (ex.: módulo já escolhido). */
  go: (key: string, data?: Record<string, string>) => void;
  data: Record<string, string>;
  /** Recria a aba (formulário limpo). */
  reset: (key: string) => void;
  /** Aviso de sucesso mostrado por cima das abas (sobrevive à troca de aba). */
  notify: (message: string) => void;
}

export const TabsContext = createContext<TabsApi | null>(null);

export function useTabs() {
  return useContext(TabsContext);
}

/**
 * Abas no topo da página ou da janela. Todas ficam montadas (o que foi
 * digitado numa aba não se perde ao trocar); só a ativa aparece.
 */
export function Tabs({ tabs, initial, label }: { tabs: TabDef[]; initial?: string; label: string }) {
  const first = tabs.find((t) => t.key === initial)?.key ?? tabs[0]?.key ?? "";
  const [active, setActive] = useState(first);
  const [data, setData] = useState<Record<string, string>>({});
  const [nonce, setNonce] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const go = useCallback((key: string, d?: Record<string, string>) => {
    setActive(key);
    setData(d ?? {});
    // Volta ao topo da área que rola (janela ou página).
    requestAnimationFrame(() => document.getElementById("abas-trilha")?.scrollIntoView({ block: "nearest" }));
  }, []);
  const reset = useCallback((key: string) => setNonce((n) => ({ ...n, [key]: (n[key] ?? 0) + 1 })), []);
  const notify = useCallback((message: string) => setNotice(message), []);

  return (
    <TabsContext.Provider value={{ active, go, data, reset, notify }}>
      <div className="grid gap-5">
        {notice && <NoticeDialog tone="ok" message={notice} onClose={() => setNotice(null)} />}
        <div
          id="abas-trilha"
          role="tablist"
          aria-label={label}
          className="sticky top-[68px] z-10 -mx-1 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface/95 p-1 shadow-[0_4px_14px_rgba(0,0,0,0.05)] backdrop-blur [.in-modal_&]:top-0"
        >
          {tabs.map((t) => {
            const on = t.key === active;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`tab-${t.key}`}
                aria-selected={on}
                aria-controls={`painel-${t.key}`}
                onClick={() => go(t.key)}
                className={cx(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-[13.5px] font-medium transition-colors",
                  on ? "bg-accent-soft text-heading shadow-[inset_0_-2px_0_rgb(var(--brand))]" : "text-muted hover:bg-sunken hover:text-ink",
                )}
              >
                <span className={on ? "text-icon" : ""}>{t.icon}</span>
                {t.label}
                {t.count !== undefined && (
                  <span className={cx("rounded-full px-1.5 text-[11px] tabular-nums", on ? "bg-surface text-ink" : "bg-sunken")}>{t.count}</span>
                )}
              </button>
            );
          })}
        </div>
        {tabs.map((t) => (
          <div
            key={`${t.key}-${nonce[t.key] ?? 0}`}
            role="tabpanel"
            id={`painel-${t.key}`}
            aria-labelledby={`tab-${t.key}`}
            hidden={t.key !== active}
            className={cx("grid gap-4 [&>*]:min-w-0", t.key !== active && "!hidden")}
          >
            {t.content}
          </div>
        ))}
      </div>
    </TabsContext.Provider>
  );
}

/**
 * Depois de salvar com sucesso numa aba: avisa, volta para a Estrutura (no
 * editor de trilha: fecha o painel e volta ao módulo) e limpa o formulário.
 */
export function AfterOk({ state, from }: { state: ActionState; from: string }) {
  const tabs = useTabs();
  const seen = useRef<ActionState | null>(null);
  useEffect(() => {
    if (!tabs || !state.ok || seen.current === state) return;
    seen.current = state;
    tabs.notify(state.ok);
    tabs.go("estrutura");
    tabs.reset(from);
  }, [state, tabs, from]);
  return null;
}

