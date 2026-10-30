"use client";

import Link from "next/link";
import { plainText } from "@/components/markdown";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContentViewer, ObjectiveNote, externalHref, type ViewerContent } from "@/components/content-viewer";
import { StudyTracker } from "@/components/study-tracker";
import { Badge, EmptyState, Input, buttonVariants, cx } from "@/components/ui";
import { KIND_LABEL } from "@/lib/learning";

export interface Material extends ViewerContent {
  description: string | null;
  category: string | null;
  estimated_minutes: number | null;
  objective: string | null;
  fileUrl: string | null;
}

/**
 * Biblioteca de materiais: lista com busca instantânea e uma janela sobre a
 * página para ver cada material sem sair da lista. Setas do teclado passam
 * para o anterior/próximo; Esc fecha. O endereço ganha ?material=<id> para
 * que o link possa ser enviado a outra pessoa.
 */
export function MaterialsBrowser({ items, viewed }: { items: Material[]; viewed: string[] }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [seen, setSeen] = useState(() => new Set(viewed));
  const dialog = useRef<HTMLDialogElement>(null);

  const filtered = useMemo(() => {
    const q = query
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    if (!q) return items;
    const norm = (s: string | null) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return items.filter((i) => norm(i.title).includes(q) || norm(i.description).includes(q) || norm(i.category).includes(q));
  }, [items, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Material[]>();
    for (const i of filtered) map.set(i.category ?? "Outros", [...(map.get(i.category ?? "Outros") ?? []), i]);
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [filtered]);

  // Ordem de navegação = ordem em que aparecem na tela.
  const ordered = useMemo(() => groups.flatMap(([, list]) => list), [groups]);
  const index = ordered.findIndex((i) => i.id === openId);
  const current = index >= 0 ? ordered[index] : items.find((i) => i.id === openId) ?? null;

  const setUrl = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("material", id);
    else url.searchParams.delete("material");
    window.history.replaceState(null, "", url);
  };

  const open = useCallback((id: string) => {
    setOpenId(id);
    setSeen((s) => new Set(s).add(id));
    setUrl(id);
  }, []);

  const close = useCallback(() => {
    setOpenId(null);
    setUrl(null);
  }, []);

  // Abre direto pelo link compartilhado (?material=<id>).
  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get("material");
    if (id && items.some((i) => i.id === id)) open(id);
  }, [items, open]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (openId && !d.open) {
      d.showModal();
      document.body.style.overflow = "hidden";
    }
    if (!openId && d.open) d.close();
    if (!openId) document.body.style.overflow = "";
  }, [openId]);

  // Esc ou fechamento nativo da janela: ouvinte direto no elemento.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onClose = () => close();
    d.addEventListener("close", onClose);
    return () => {
      d.removeEventListener("close", onClose);
      document.body.style.overflow = "";
    };
  }, [close]);

  const go = useCallback(
    (delta: number) => {
      if (index < 0) return;
      const next = ordered[index + delta];
      if (next) open(next.id);
    },
    [index, ordered, open],
  );

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, go]);

  const href = current ? externalHref(current, current.fileUrl) : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, descrição ou categoria"
          aria-label="Buscar material"
          className="max-w-md"
        />
        <span className="text-[12.5px] tabular-nums text-muted">
          {filtered.length} de {items.length} materiais
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={items.length ? "Nenhum material encontrado" : "Nenhum material disponível para você ainda"} />
      ) : (
        groups.map(([cat, list]) => (
          <section key={cat} className="grid gap-2">
            <h2 className="flex items-baseline gap-2 text-[13px] font-semibold uppercase tracking-[0.05em] text-muted">
              {cat} <span className="font-mono text-[11px] font-normal">{list.length}</span>
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {list.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => open(c.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent-soft/40 focus-visible:bg-accent-soft/40"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{c.title}</span>
                      {c.description && <span className="block text-[12.5px] text-muted">{plainText(c.description)}</span>}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {seen.has(c.id) && <Badge tone="ok">Visto</Badge>}
                      <Badge>{KIND_LABEL[c.kind]}</Badge>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <dialog
        ref={dialog}
        onClick={(e) => {
          // Clique fora do painel (no fundo escurecido) fecha.
          if (e.target === dialog.current) close();
        }}
        aria-labelledby="material-title"
        className="m-auto h-[100dvh] max-h-[100dvh] w-full max-w-full bg-transparent p-0 backdrop:bg-ink/60 backdrop:backdrop-blur-[2px] sm:h-[92dvh] sm:max-h-[92dvh] sm:w-[min(1100px,94vw)] sm:max-w-[94vw]"
      >
        {current && (
          <div className="flex h-full flex-col overflow-hidden bg-surface text-ink sm:rounded-xl sm:border sm:border-line">
            <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-accent">
                  {current.category ?? "Material"} · {KIND_LABEL[current.kind]}
                  {index >= 0 && <span className="text-muted"> · {index + 1} de {ordered.length}</span>}
                </p>
                <h2 id="material-title" className="truncate text-[17px] font-semibold">{current.title}</h2>
                {current.description && <p className="line-clamp-2 text-[13px] text-muted">{plainText(current.description)}</p>}
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-[18px] leading-none hover:bg-sunken"
              >
                ×
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="flex min-h-full flex-col gap-4">
                <ContentViewer key={current.id} content={current} fileUrl={current.fileUrl} fill />
                {current.objective && <ObjectiveNote text={current.objective} />}
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 sm:px-5">
              <div className="flex gap-2">
                <button type="button" onClick={() => go(-1)} disabled={index <= 0} className={buttonVariants.secondary}>
                  ← Anterior
                </button>
                <button type="button" onClick={() => go(1)} disabled={index < 0 || index >= ordered.length - 1} className={buttonVariants.secondary}>
                  Próximo →
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/estudar/${current.id}`} className="text-[13px] font-medium text-accent hover:underline">
                  Abrir em página inteira
                </Link>
                {href && (
                  <a href={href} target="_blank" rel="noopener noreferrer" className={cx(buttonVariants.primary, "py-1.5")}>
                    Abrir em nova aba ↗
                  </a>
                )}
              </div>
            </footer>
            {/* Registra acesso e tempo enquanto a janela estiver aberta neste material. */}
            <StudyTracker key={`t-${current.id}`} contentId={current.id} />
          </div>
        )}
      </dialog>
    </>
  );
}
