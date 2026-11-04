"use client";

import { Maximize2, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "@/components/ui";

export type ModalVariant = "drawer" | "center";

/**
 * Janela sobre a página: "drawer" encosta à direita (ver e editar);
 * "center" fica centralizada (prévia da trilha). Cantos arredondados,
 * fecha com Esc, clique fora ou no X.
 */
export function ModalPanel({
  variant = "drawer",
  label,
  onClose,
  fullPageHref,
  children,
}: {
  variant?: ModalVariant;
  label: string;
  onClose: () => void;
  /** Endereço para abrir o mesmo conteúdo em página inteira. */
  fullPageHref?: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      // Esc de uma janela de confirmação aberta por cima fecha só ela.
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        close.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, []);

  const drawer = variant === "drawer";
  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <div aria-hidden className="modal-backdrop absolute inset-0 bg-[rgb(8_14_24/0.48)] backdrop-blur-[1.5px]" onClick={() => close.current()} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cx(
          "in-modal absolute flex flex-col overflow-hidden border border-line bg-bg shadow-[0_24px_70px_rgba(0,0,0,0.32)] outline-none",
          drawer
            ? "modal-drawer inset-y-2 right-2 w-[calc(100vw-1rem)] rounded-2xl sm:inset-y-3 sm:right-3 sm:w-[min(940px,calc(100vw-1.5rem))]"
            : "modal-center inset-x-2 top-2 bottom-2 mx-auto max-w-[1040px] rounded-2xl sm:inset-x-6 sm:top-[4vh] sm:bottom-[4vh]",
        )}
      >
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-line bg-surface px-3 sm:px-4">
          <p className="truncate text-[12.5px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</p>
          <div className="flex items-center gap-1">
            {fullPageHref && (
              <a
                href={fullPageHref}
                title="Abrir em página inteira"
                aria-label="Abrir em página inteira"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
              >
                <Maximize2 size={15} aria-hidden />
              </a>
            )}
            <button
              type="button"
              onClick={() => close.current()}
              title="Fechar (Esc)"
              aria-label="Fechar"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="grid gap-6 p-4 sm:p-6 [&>*]:min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
