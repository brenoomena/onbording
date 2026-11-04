"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { ModalPanel, type ModalVariant } from "@/components/modal-panel";

/**
 * Página aberta por cima da lista (rota interceptada). O endereço muda, então
 * recarregar ou compartilhar o link abre a página inteira normalmente.
 */
export function RouteModal({ variant = "drawer", label, children }: { variant?: ModalVariant; label: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const qs = search.toString();
  return (
    <ModalPanel variant={variant} label={label} onClose={() => router.back()} fullPageHref={`${pathname}${qs ? `?${qs}` : ""}`}>
      {children}
    </ModalPanel>
  );
}
