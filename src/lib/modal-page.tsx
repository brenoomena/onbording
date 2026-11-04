import { Suspense, type ComponentType } from "react";
import { RouteModal } from "@/components/route-modal";
import type { ModalVariant } from "@/components/modal-panel";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Envolve uma página existente para abri-la como janela (rotas do slot @modal).
 * As rotas da janela usam um nome de parâmetro próprio (ex.: [conteudoId]) para
 * não colidir com o [id] da página que fica por trás; aqui ele volta a ser `id`.
 */
export function modalPage(Page: ComponentType<any>, label: string, variant: ModalVariant = "drawer", param?: string) {
  return function ModalRoute(props: any) {
    const params = param
      ? Promise.resolve(props.params).then((p: Record<string, string>) => ({ ...p, id: p[param] }))
      : props.params;
    return (
      <Suspense fallback={null}>
        <RouteModal label={label} variant={variant}>
          <Page {...props} params={params} />
        </RouteModal>
      </Suspense>
    );
  };
}
