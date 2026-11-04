import type { ZodError } from "zod";

export interface ActionState {
  ok?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /**
   * Para onde ir depois da ação (substitui o endereço atual). Feito no
   * navegador e não com redirect() do servidor, que trava quando a ação
   * roda dentro de uma janela de rota interceptada.
   */
  redirectTo?: string;
}

export function fromZod(error: ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  const first = error.issues[0]?.message;
  return { error: first ? `Confira os dados: ${first}` : "Confira os dados informados.", fieldErrors };
}

/** Lê um FormData como objeto simples, transformando "" em undefined. */
export function formObject(fd: FormData): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    out[k] = t === "" ? undefined : t;
  }
  return out;
}
