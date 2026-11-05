import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, asSystem, asUser, createPerson, createTestDb, type TestDb } from "./helpers";

const run = TEST_DATABASE_URL ? describe : describe.skip;

const Q = [
  { kind: "unica", prompt: "Capital do Brasil?", points: 1, explanation: "Brasília desde 1960.", options: [{ id: "a", label: "Rio", correct: false }, { id: "b", label: "Brasília", correct: true }] },
  { kind: "multipla", prompt: "Quais são módulos do Domínio?", points: 1, options: [{ id: "a", label: "Folha", correct: true }, { id: "b", label: "Escrita Fiscal", correct: true }, { id: "c", label: "Photoshop", correct: false }] },
  { kind: "vf", prompt: "O onboarding tem trilhas.", points: 1, options: [{ id: "v", label: "Verdadeiro", correct: true }, { id: "f", label: "Falso", correct: false }] },
];

run("Avaliações · perguntas, tentativas e correção", () => {
  let db: TestDb;
  let admin: string;
  let sup: string;
  let vendedor: string;
  let outro: string;
  let track: string;
  let quiz: string;
  let aberta: string;
  let qIds: string[] = [];

  const newQuiz = async (title: string, max: number | null) =>
    asUser(db.pool, admin, async (q) => {
      const id = (await q(
        "insert into contents (title, kind, track_id, status, passing_score, max_attempts) values ($1, 'avaliacao', $2, 'publicado', 70, $3) returning id",
        [title, track, max],
      )).rows[0].id as string;
      const mod = (await q("select id from modules where track_id = $1 order by position limit 1", [track])).rows[0].id;
      await q("insert into module_items (module_id, content_id, position, is_required) values ($1, $2, (select coalesce(max(position), 0) + 1 from module_items where module_id = $1), false)", [mod, id]);
      return id;
    });

  beforeAll(async () => {
    db = await createTestDb();
    admin = await createPerson(db.pool, { name: "Ana Admin", email: "ana@x.com", role: "admin" });
    sup = await createPerson(db.pool, { name: "Sérgio Supervisor", email: "sergio@x.com", role: "supervisor" });
    vendedor = await createPerson(db.pool, { name: "Vera Vendedora", email: "vera@x.com", role: "colaborador", area: "Contábil", supervisorId: sup });
    outro = await createPerson(db.pool, { name: "Otávio Outro", email: "otavio@x.com", role: "supervisor" });
    track = (await asSystem(db.pool, (q) => q("select id from tracks where name = 'Onboarding Comercial'"))).rows[0].id;
    quiz = await newQuiz("Prova de produtos", 3);
    await asUser(db.pool, admin, (q) => q("select public.save_quiz_questions($1, $2::jsonb)", [quiz, JSON.stringify(Q)]));
    qIds = (await asSystem(db.pool, (q) => q("select id from quiz_questions where content_id = $1 order by position", [quiz]))).rows.map((r) => r.id);
  }, 60_000);

  afterAll(async () => {
    await db?.drop();
  });

  it("valida as alternativas e só aceita perguntas em avaliação", async () => {
    await expect(
      asUser(db.pool, admin, (q) =>
        q("select public.save_quiz_questions($1, $2::jsonb)", [quiz, JSON.stringify([{ ...Q[0], options: [{ id: "a", label: "x", correct: true }, { id: "b", label: "y", correct: true }] }])]),
      ),
    ).rejects.toThrow(/quiz_questions_options_check/);
    const texto = (await asSystem(db.pool, (q) => q("select id from contents where kind = 'texto' limit 1"))).rows[0];
    if (texto) {
      await expect(asUser(db.pool, admin, (q) => q("select public.save_quiz_questions($1, $2::jsonb)", [texto.id, JSON.stringify(Q)]))).rejects.toThrow(/Avaliação/);
    }
    // Avaliação não pode ser material de biblioteca.
    await expect(asUser(db.pool, admin, (q) => q("update contents set is_library = true where id = $1", [quiz]))).rejects.toThrow(/contents_quiz_in_track/);
  });

  it("colaborador não lê o gabarito: tabela fechada e get_quiz sem 'correct'", async () => {
    const direct = await asUser(db.pool, vendedor, (q) => q("select count(*)::int n from quiz_questions where content_id = $1", [quiz]));
    expect(direct.rows[0].n).toBe(0);
    const g = (await asUser(db.pool, vendedor, (q) => q("select public.get_quiz($1) g", [quiz]))).rows[0].g;
    expect(g.questions).toHaveLength(3);
    expect(JSON.stringify(g.questions)).not.toContain("correct");
    expect(g).toMatchObject({ passing_score: 70, max_attempts: 3, attempts_used: 0, can_attempt: true, approved: false });
  });

  it("corrige no banco: reprova abaixo da nota, aprova com a melhor tentativa e conclui a etapa", async () => {
    const wrong = { [qIds[0]]: { options: ["a"] }, [qIds[1]]: { options: ["a"] }, [qIds[2]]: { options: ["v"] } };
    const r1 = (await asUser(db.pool, vendedor, (q) => q("select public.submit_quiz($1, $2::jsonb) r", [quiz, JSON.stringify(wrong)]))).rows[0].r;
    expect(r1).toMatchObject({ status: "reprovada", score: 33.33 });
    const g1 = (await asUser(db.pool, vendedor, (q) => q("select public.get_quiz($1) g", [quiz]))).rows[0].g;
    // Reprovado: mostra acerto/erro, mas não qual era a correta.
    expect(g1.last_attempt.questions[0].correct).toBe(false);
    expect(g1.last_attempt.questions[0].options.every((o: { correct: unknown }) => o.correct === null)).toBe(true);
    expect(g1.last_attempt.questions[0].explanation).toBeNull();

    // "Marcar como concluído" não vale para avaliação.
    await expect(asUser(db.pool, vendedor, (q) => q("select public.complete_content($1)", [quiz]))).rejects.toThrow(/aprovado/);

    const right = { [qIds[0]]: { options: ["b"] }, [qIds[1]]: { options: ["a", "b"] }, [qIds[2]]: { options: ["v"] } };
    const r2 = (await asUser(db.pool, vendedor, (q) => q("select public.submit_quiz($1, $2::jsonb) r", [quiz, JSON.stringify(right)]))).rows[0].r;
    expect(r2).toMatchObject({ status: "aprovada", score: 100 });
    const cp = await asSystem(db.pool, (q) => q("select status from content_progress where profile_id = $1 and content_id = $2", [vendedor, quiz]));
    expect(cp.rows[0].status).toBe("concluido");
    const g2 = (await asUser(db.pool, vendedor, (q) => q("select public.get_quiz($1) g", [quiz]))).rows[0].g;
    expect(g2).toMatchObject({ approved: true, can_attempt: false, best_score: 100 });
    expect(g2.last_attempt.questions[0].explanation).toBe("Brasília desde 1960.");
    await expect(asUser(db.pool, vendedor, (q) => q("select public.submit_quiz($1, $2::jsonb)", [quiz, JSON.stringify(right)]))).rejects.toThrow(/já foi aprovado/);
  });

  it("limite de tentativas", async () => {
    const lim = await newQuiz("Prova curta", 1);
    await asUser(db.pool, admin, (q) => q("select public.save_quiz_questions($1, $2::jsonb)", [lim, JSON.stringify([Q[2]])]));
    const qid = (await asSystem(db.pool, (q) => q("select id from quiz_questions where content_id = $1", [lim]))).rows[0].id;
    await asUser(db.pool, vendedor, (q) => q("select public.submit_quiz($1, $2::jsonb)", [lim, JSON.stringify({ [qid]: { options: ["f"] } })]));
    await expect(
      asUser(db.pool, vendedor, (q) => q("select public.submit_quiz($1, $2::jsonb)", [lim, JSON.stringify({ [qid]: { options: ["v"] } })])),
    ).rejects.toThrow(/todas as tentativas/);
  });

  it("resposta aberta: fica em correção e o supervisor da pessoa corrige", async () => {
    aberta = await newQuiz("Prova dissertativa", null);
    await asUser(db.pool, admin, (q) =>
      q("select public.save_quiz_questions($1, $2::jsonb)", [aberta, JSON.stringify([Q[2], { kind: "aberta", prompt: "Explique o produto.", points: 3 }])]),
    );
    const ids = (await asSystem(db.pool, (q) => q("select id from quiz_questions where content_id = $1 order by position", [aberta]))).rows.map((r) => r.id);
    const r = (await asUser(db.pool, vendedor, (q) =>
      q("select public.submit_quiz($1, $2::jsonb) r", [aberta, JSON.stringify({ [ids[0]]: { options: ["v"] }, [ids[1]]: { text: "É um sistema contábil." } })]),
    )).rows[0].r;
    expect(r.status).toBe("em_correcao");
    const attempt = r.id as string;
    // Nova tentativa só depois da correção.
    await expect(asUser(db.pool, vendedor, (q) => q("select public.submit_quiz($1, '{}'::jsonb)", [aberta]))).rejects.toThrow(/em correção/);
    // O colaborador não lê a tabela de tentativas; o supervisor dele lê.
    expect((await asUser(db.pool, vendedor, (q) => q("select count(*)::int n from quiz_attempts"))).rows[0].n).toBe(0);
    expect((await asUser(db.pool, sup, (q) => q("select count(*)::int n from quiz_attempts where id = $1", [attempt]))).rows[0].n).toBe(1);
    // Ninguém corrige a própria prova; supervisor de outra equipe não corrige.
    await expect(asUser(db.pool, vendedor, (q) => q("select public.grade_quiz_attempt($1, '{}'::jsonb, null)", [attempt]))).rejects.toThrow(/não pode corrigir/);
    await expect(asUser(db.pool, outro, (q) => q("select public.grade_quiz_attempt($1, '{}'::jsonb, null)", [attempt]))).rejects.toThrow(/não pode corrigir/);
    // Nota fora da faixa é recusada.
    await expect(
      asUser(db.pool, sup, (q) => q("select public.grade_quiz_attempt($1, $2::jsonb, null)", [attempt, JSON.stringify({ [ids[1]]: { awarded: 5 } })])),
    ).rejects.toThrow(/0 ao valor/);
    const g = (await asUser(db.pool, sup, (q) =>
      q("select public.grade_quiz_attempt($1, $2::jsonb, 'Bom trabalho') g", [attempt, JSON.stringify({ [ids[1]]: { awarded: 2, comment: "Faltou citar a folha" } })]),
    )).rows[0].g;
    expect(g).toEqual({ status: "aprovada", score: 75 });
    const cp = await asSystem(db.pool, (q) => q("select status from content_progress where profile_id = $1 and content_id = $2", [vendedor, aberta]));
    expect(cp.rows[0].status).toBe("concluido");
    const view = (await asUser(db.pool, vendedor, (q) => q("select public.get_quiz($1) g", [aberta]))).rows[0].g;
    expect(view.last_attempt).toMatchObject({ status: "aprovada", feedback: "Bom trabalho" });
    expect(view.last_attempt.questions[1]).toMatchObject({ awarded: 2, comment: "Faltou citar a folha" });
    await expect(asUser(db.pool, sup, (q) => q("select public.grade_quiz_attempt($1, '{}'::jsonb, null)", [attempt]))).rejects.toThrow(/já foi corrigida/);
  });
});
