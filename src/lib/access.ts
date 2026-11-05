/**
 * Regras de entrada pelo Google. Só entra quem tem cadastro de colaborador
 * ativo com o mesmo e-mail da conta Google. Funções puras (testadas).
 */

export type AccessDenied = "nao-liberado" | "inativo" | "dominio" | "cancelado" | "google";

/** Mensagens da tela de login para cada motivo de recusa. */
export const DENIED_MESSAGE: Record<AccessDenied | "saiu", { tone: "ok" | "warn" | "danger"; text: string }> = {
  "nao-liberado": {
    tone: "danger",
    text: "Esta conta Google não tem acesso liberado. Peça ao administrador para cadastrar o seu e-mail como colaborador e tente de novo.",
  },
  inativo: { tone: "danger", text: "Seu acesso foi desativado por um administrador. Se acha que é um engano, fale com o seu gestor." },
  dominio: { tone: "danger", text: "Use a conta Google do e-mail corporativo cadastrado na plataforma." },
  cancelado: { tone: "warn", text: "O login com Google foi cancelado. Tente de novo quando quiser." },
  google: { tone: "danger", text: "Não foi possível entrar com Google agora. Tente de novo em instantes; se continuar, avise o administrador." },
  saiu: { tone: "ok", text: "Você saiu da plataforma." },
};

/**
 * Erro devolvido pelo Supabase/Google na volta do login (?error=…).
 * Com o cadastro aberto desligado no Supabase, uma conta sem cadastro chega
 * aqui como "Signups not allowed".
 */
export function deniedFromProviderError(error: string | null, description: string | null): AccessDenied {
  const d = `${error ?? ""} ${description ?? ""}`.toLowerCase();
  if (/signup|sign up|not allowed|user not found|banned/.test(d)) return "nao-liberado";
  if (/access_denied|cancel|denied/.test(d)) return "cancelado";
  return "google";
}

/** Decide se a conta autenticada pode entrar. */
export function decideAccess(
  email: string | null | undefined,
  profile: { status: string } | null,
  domain: string,
): { ok: true } | { ok: false; reason: AccessDenied } {
  const mail = (email ?? "").trim().toLowerCase();
  if (domain && !mail.endsWith(`@${domain}`)) return { ok: false, reason: "dominio" };
  if (!profile) return { ok: false, reason: "nao-liberado" };
  if (profile.status === "inativo") return { ok: false, reason: "inativo" };
  return { ok: true };
}

export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/painel";
}

/** Frase abaixo do botão de login. */
export function domainHint(domain: string | undefined | null) {
  return domain ? `Use a conta Google @${domain} cadastrada pelo seu gestor.` : "Use a conta Google do e-mail cadastrado pelo seu gestor.";
}
