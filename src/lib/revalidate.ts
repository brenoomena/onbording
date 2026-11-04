import "server-only";
import { revalidatePath as nextRevalidatePath } from "next/cache";
import { headers } from "next/headers";

/** A ação veio de uma janela de rota interceptada? (marcado no middleware) */
async function fromModal(): Promise<boolean> {
  return (await headers()).get("x-em-janela") === "1";
}

/**
 * revalidatePath, exceto quando a ação roda dentro de uma janela: nesse caso
 * o Next 15 trava ao aplicar a página atualizada que volta junto com a
 * resposta. A própria janela atualiza a tela depois (router.refresh), e as
 * outras páginas são buscadas de novo ao navegar.
 */
export async function revalidatePath(path: string, type?: "page" | "layout") {
  if (await fromModal()) return;
  nextRevalidatePath(path, type);
}
