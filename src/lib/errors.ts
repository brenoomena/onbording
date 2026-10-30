/** Converte erros do Postgres/PostgREST em mensagens para quem usa a tela. */
export interface DbError {
  code?: string;
  message?: string;
  details?: string | null;
}

export function friendlyError(err: DbError | null | undefined, fallback = "Não foi possível salvar. Tente novamente."): string {
  if (!err) return fallback;
  switch (err.code) {
    case "23505":
      return "Já existe um registro com esse nome ou e-mail.";
    case "23503":
      return "Este registro está em uso por outros cadastros. Desative-o em vez de excluir.";
    case "23514":
      return "Algum campo está fora do formato esperado. Confira os dados e tente de novo.";
    case "42501":
      // Mensagens das travas de negócio já vêm em português.
      return err.message && !err.message.startsWith("new row violates") && !err.message.startsWith("permission denied")
        ? err.message
        : "Você não tem permissão para fazer esta alteração.";
    case "P0001":
      return err.message ?? fallback;
    case "PGRST116":
      return "Registro não encontrado ou sem permissão de acesso.";
    default:
      return fallback;
  }
}
