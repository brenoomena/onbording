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
      // Travas de negócio (ex.: conteúdo de outra trilha) chegam com mensagem própria.
      if (err.message?.includes("contents_track_or_library")) return "Escolha a trilha do conteúdo ou marque-o como material da Biblioteca.";
      if (err.message?.includes("contents_quiz_in_track")) return "Avaliação fica sempre dentro de uma trilha: não pode ir para a Biblioteca.";
      if (err.message?.includes("quiz_questions_options_check")) return "Confira as alternativas das perguntas: cada pergunta precisa de alternativas preenchidas e da resposta correta marcada.";
      return err.message && !err.message.includes("violates check constraint")
        ? err.message
        : "Algum campo está fora do formato esperado. Confira os dados e tente de novo.";
    case "42501":
      // Mensagens das travas de negócio já vêm em português.
      return err.message && !err.message.startsWith("new row violates") && !err.message.startsWith("permission denied")
        ? err.message
        : "Você não tem permissão para fazer esta alteração.";
    case "P0001":
    case "P0002":
      return err.message ?? fallback;
    case "PGRST116":
      return "Registro não encontrado ou sem permissão de acesso.";
    default:
      return fallback;
  }
}
