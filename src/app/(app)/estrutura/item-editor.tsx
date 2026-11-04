"use client";

import { Pencil } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ModalPanel } from "@/components/modal-panel";
import { iconButtonClass } from "@/components/ui";

/**
 * Linha da lista com o botão Editar, que abre o formulário numa janela à
 * direita. As ações rápidas (excluir…) ficam ao lado; sem permissão de
 * editar, a linha só mostra o resumo e as ações permitidas.
 */
export function InlineEditor({
  summary,
  children,
  actions,
  canEdit = true,
  title = "Editar",
}: {
  summary: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  canEdit?: boolean;
  /** Título da janela de edição. */
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">{summary}</div>
      <div className="flex shrink-0 items-center gap-0.5">
        {canEdit && (
          <button type="button" onClick={() => setOpen(true)} title={title} aria-label={title} className={iconButtonClass("brand")}>
            <Pencil size={16} strokeWidth={1.9} aria-hidden />
          </button>
        )}
        {actions}
      </div>
      {open &&
        mounted &&
        createPortal(
          <ModalPanel label={title} onClose={() => setOpen(false)}>
            <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5">
              <div className="border-b border-line pb-3">{summary}</div>
              {children}
            </section>
          </ModalPanel>,
          document.body,
        )}
    </div>
  );
}
