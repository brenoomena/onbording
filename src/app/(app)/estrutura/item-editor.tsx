"use client";

import { Pencil, X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Linha da lista com edição no próprio lugar. As ações rápidas (excluir…)
 * ficam ao lado do botão Editar; sem permissão de editar, a linha só mostra
 * o resumo e as ações permitidas.
 */
export function InlineEditor({
  summary,
  children,
  actions,
  canEdit = true,
}: {
  summary: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  canEdit?: boolean;
}) {
  if (!canEdit) {
    return (
      <div className="flex items-center justify-between gap-3">
        {summary}
        {actions && <div className="flex shrink-0 items-center gap-0.5">{actions}</div>}
      </div>
    );
  }
  return (
    <div className="relative">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 pr-10 [&::-webkit-details-marker]:hidden">
          {summary}
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-semibold text-accent group-open:bg-accent-soft">
            <span className="inline-flex items-center gap-1 group-open:hidden"><Pencil size={14} aria-hidden /> Editar</span>
            <span className="hidden items-center gap-1 group-open:inline-flex"><X size={14} aria-hidden /> Fechar</span>
          </span>
        </summary>
        <div className="mt-3 rounded-lg border border-line bg-bg p-4">{children}</div>
      </details>
      {actions && <div className="absolute right-0 top-0 flex items-center gap-0.5">{actions}</div>}
    </div>
  );
}
