"use client";

import type { ReactNode } from "react";

/** Linha que abre um formulário de edição no próprio lugar. */
export function InlineEditor({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        {summary}
        <span className="shrink-0 rounded-md px-2 py-1 text-[12.5px] font-semibold text-accent group-open:bg-accent-soft">
          <span className="group-open:hidden">Editar</span>
          <span className="hidden group-open:inline">Fechar</span>
        </span>
      </summary>
      <div className="mt-3 rounded-lg border border-line bg-bg p-4">{children}</div>
    </details>
  );
}
