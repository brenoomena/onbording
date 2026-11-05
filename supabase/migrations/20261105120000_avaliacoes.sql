-- =====================================================================
-- Avaliações: novo tipo de conteúdo que entra no módulo como uma etapa.
--
-- * Perguntas de escolha única, múltipla escolha, verdadeiro ou falso e
--   resposta aberta (corrigida pelo gestor).
-- * Nota mínima por avaliação; tentativas ilimitadas ou com limite; vale a
--   melhor nota. Aprovou, a etapa conta como concluída.
-- * O gabarito nunca vai para o colaborador: ele lê a prova e envia as
--   respostas só pelas funções get_quiz / submit_quiz, que corrigem no banco.
-- * Cada tentativa guarda uma cópia das perguntas e respostas: editar a
--   avaliação depois não altera o histórico.
--
-- Comparações com o novo valor do enum usam kind::text, porque um valor
-- novo de enum não pode ser usado na mesma transação em que foi criado.
-- =====================================================================

alter type public.content_kind add value if not exists 'avaliacao';

alter table public.contents
  add column if not exists passing_score integer not null default 70,
  add column if not exists max_attempts integer;
alter table public.contents drop constraint if exists contents_passing_score_check;
alter table public.contents add constraint contents_passing_score_check check (passing_score between 0 and 100);
alter table public.contents drop constraint if exists contents_max_attempts_check;
alter table public.contents add constraint contents_max_attempts_check check (max_attempts is null or max_attempts between 1 and 20);

alter table public.contents drop constraint if exists contents_kind_fields;
alter table public.contents add constraint contents_kind_fields check (
  (kind::text = 'texto' and body is not null and length(btrim(body)) > 0)
  or (kind::text in ('link', 'video') and url is not null)
  or (kind::text = 'arquivo' and storage_path is not null)
  or kind::text = 'avaliacao'
);
-- Avaliação existe só dentro de uma trilha (não é material de biblioteca).
alter table public.contents drop constraint if exists contents_quiz_in_track;
alter table public.contents add constraint contents_quiz_in_track
  check (kind::text <> 'avaliacao' or (track_id is not null and not is_library));

-- ---------------------------------------------------------------------
-- Permissão: corrigir avaliações (respostas abertas)
-- ---------------------------------------------------------------------
insert into public.permissions (key, module, name, description, sort_order) values
  ('avaliacoes.corrigir', 'Relatórios', 'Corrigir avaliações', 'Corrige respostas abertas e aprova avaliações de quem acompanha (equipe ou todos).', 62)
on conflict (key) do update set module = excluded.module, name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;
insert into public.role_permissions (role_id, permission_key)
select id, 'avaliacoes.corrigir' from public.roles where key = 'supervisor'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Perguntas
-- ---------------------------------------------------------------------
create or replace function private.valid_quiz_options(p_kind text, p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p) <> 'array' then false
    when p_kind = 'aberta' then jsonb_array_length(p) = 0
    else
      jsonb_array_length(p) between 2 and 10
      and not exists (
        select 1 from jsonb_array_elements(p) o
        where jsonb_typeof(o) <> 'object'
           or jsonb_typeof(o -> 'id') <> 'string' or length(o ->> 'id') not between 1 and 40
           or jsonb_typeof(o -> 'label') <> 'string' or length(btrim(o ->> 'label')) not between 1 and 500
           or jsonb_typeof(o -> 'correct') <> 'boolean'
           or exists (select 1 from jsonb_object_keys(o) k where k not in ('id', 'label', 'correct'))
      )
      and (select count(distinct o ->> 'id') from jsonb_array_elements(p) o) = jsonb_array_length(p)
      and case p_kind
        when 'multipla' then (select count(*) from jsonb_array_elements(p) o where (o ->> 'correct')::boolean) >= 1
        when 'vf' then jsonb_array_length(p) = 2 and (select count(*) from jsonb_array_elements(p) o where (o ->> 'correct')::boolean) = 1
        else (select count(*) from jsonb_array_elements(p) o where (o ->> 'correct')::boolean) = 1
      end
  end;
$$;

create table if not exists public.quiz_questions (
  id          uuid primary key default gen_random_uuid(),
  content_id  uuid not null references public.contents (id) on delete cascade,
  position    integer not null,
  kind        text not null check (kind in ('unica', 'multipla', 'vf', 'aberta')),
  prompt      text not null check (length(btrim(prompt)) between 1 and 2000),
  explanation text check (explanation is null or length(explanation) <= 2000),
  points      integer not null default 1 check (points between 1 and 100),
  options     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  constraint quiz_questions_options_check check (private.valid_quiz_options(kind, options)),
  constraint quiz_questions_position_unique unique (content_id, position) deferrable initially deferred
);

-- Só avaliações têm perguntas.
create or replace function private.check_quiz_question_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.contents c where c.id = new.content_id and c.kind::text = 'avaliacao') then
    raise exception 'Perguntas só podem ser cadastradas em conteúdos do tipo Avaliação.' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists quiz_questions_content_check on public.quiz_questions;
create trigger quiz_questions_content_check before insert or update on public.quiz_questions
  for each row execute function private.check_quiz_question_content();

alter table public.quiz_questions enable row level security;
-- Gabarito: só a gestão lê a tabela; o colaborador usa get_quiz().
drop policy if exists quiz_questions_select on public.quiz_questions;
create policy quiz_questions_select on public.quiz_questions for select to authenticated using (
  public.is_active_user() and (
    public.has_permission('conteudos.ver') or public.has_permission('trilhas.ver')
    or public.has_permission('avaliacoes.corrigir') or public.has_permission('progresso.ver')
  )
);
drop policy if exists quiz_questions_write on public.quiz_questions;
create policy quiz_questions_write on public.quiz_questions for all to authenticated
  using (public.has_permission('conteudos.editar') or public.has_permission('conteudos.criar'))
  with check (public.has_permission('conteudos.editar') or public.has_permission('conteudos.criar'));

-- ---------------------------------------------------------------------
-- Tentativas
-- ---------------------------------------------------------------------
create table if not exists public.quiz_attempts (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles (id) on delete restrict,
  content_id     uuid not null references public.contents (id) on delete restrict,
  submitted_at   timestamptz not null default now(),
  status         text not null check (status in ('em_correcao', 'aprovada', 'reprovada')),
  score          numeric(5, 2) not null check (score between 0 and 100),
  points_awarded numeric(7, 2) not null default 0,
  points_total   integer not null,
  passing_score  integer not null,
  -- Cópia das perguntas e respostas no momento do envio:
  -- [{question_id, kind, prompt, explanation, points, options:[{id,label,correct,selected}],
  --   text, awarded, correct, comment}]
  answers        jsonb not null,
  graded_by      uuid references public.profiles (id) on delete set null,
  graded_at      timestamptz,
  feedback       text check (feedback is null or length(feedback) <= 2000)
);
create index if not exists quiz_attempts_person_idx on public.quiz_attempts (profile_id, content_id, submitted_at desc);
create index if not exists quiz_attempts_pending_idx on public.quiz_attempts (status) where status = 'em_correcao';

alter table public.quiz_attempts enable row level security;
-- O colaborador vê as próprias tentativas só por get_quiz() (sem gabarito).
drop policy if exists quiz_attempts_select on public.quiz_attempts;
create policy quiz_attempts_select on public.quiz_attempts for select to authenticated using (
  profile_id <> auth.uid() and public.can_view_progress_of(profile_id)
);
-- Gravação só pelas funções abaixo.

-- ---------------------------------------------------------------------
-- Funções
-- ---------------------------------------------------------------------

-- Grava as perguntas de uma avaliação (substitui todas), com as permissões de quem salva.
create or replace function public.save_quiz_questions(p_content uuid, p_questions jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  q jsonb;
  i integer := 0;
begin
  if jsonb_typeof(p_questions) <> 'array' then
    raise exception 'Perguntas inválidas.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_questions) > 100 then
    raise exception 'Use no máximo 100 perguntas por avaliação.' using errcode = '22023';
  end if;
  delete from public.quiz_questions where content_id = p_content;
  for q in select value from jsonb_array_elements(p_questions)
  loop
    i := i + 1;
    insert into public.quiz_questions (content_id, position, kind, prompt, explanation, points, options)
    values (
      p_content, i, q ->> 'kind', q ->> 'prompt', nullif(btrim(coalesce(q ->> 'explanation', '')), ''),
      coalesce((q ->> 'points')::integer, 1),
      case when q ->> 'kind' = 'aberta' then '[]'::jsonb else coalesce(q -> 'options', '[]'::jsonb) end
    );
  end loop;
  return i;
end;
$$;
revoke all on function public.save_quiz_questions(uuid, jsonb) from public;
grant execute on function public.save_quiz_questions(uuid, jsonb) to authenticated;

-- Resultado de uma tentativa para o colaborador: acerto por pergunta,
-- sem revelar a alternativa correta enquanto não for aprovado.
create or replace function private.attempt_for_learner(a public.quiz_attempts)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', a.id,
    'submitted_at', a.submitted_at,
    'status', a.status,
    'score', a.score,
    'feedback', a.feedback,
    'graded_at', a.graded_at,
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'question_id', x -> 'question_id',
        'prompt', x -> 'prompt',
        'kind', x -> 'kind',
        'points', x -> 'points',
        'awarded', x -> 'awarded',
        'correct', x -> 'correct',
        'comment', x -> 'comment',
        'text', x -> 'text',
        'explanation', case when a.status = 'aprovada' then x -> 'explanation' end,
        'options', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', o -> 'id', 'label', o -> 'label', 'selected', o -> 'selected',
            'correct', case when a.status = 'aprovada' then o -> 'correct' end
          ) order by ord), '[]'::jsonb)
          from jsonb_array_elements(x -> 'options') with ordinality as t(o, ord)
        )
      ) order by n), '[]'::jsonb)
      from jsonb_array_elements(a.answers) with ordinality as s(x, n)
    )
  );
$$;

-- Prova para o colaborador: perguntas sem gabarito + situação das tentativas.
create or replace function public.get_quiz(p_content uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.contents;
  v_used integer;
  v_best numeric;
  v_approved boolean;
  v_pending boolean;
  v_last public.quiz_attempts;
begin
  if auth.uid() is null or not public.can_view_content(p_content) then
    raise exception 'Avaliação não disponível para você.' using errcode = '42501';
  end if;
  select * into c from public.contents where id = p_content;
  if c.kind::text <> 'avaliacao' then
    raise exception 'Este conteúdo não é uma avaliação.' using errcode = '22023';
  end if;

  select count(*), max(score), bool_or(status = 'aprovada'), bool_or(status = 'em_correcao')
    into v_used, v_best, v_approved, v_pending
  from public.quiz_attempts where profile_id = auth.uid() and content_id = p_content;
  select * into v_last from public.quiz_attempts
  where profile_id = auth.uid() and content_id = p_content order by submitted_at desc limit 1;

  return jsonb_build_object(
    'passing_score', c.passing_score,
    'max_attempts', c.max_attempts,
    'attempts_used', v_used,
    'best_score', v_best,
    'approved', coalesce(v_approved, false),
    'pending', coalesce(v_pending, false),
    'can_attempt', not coalesce(v_approved, false) and not coalesce(v_pending, false)
                   and (c.max_attempts is null or v_used < c.max_attempts),
    'last_attempt', case when v_last.id is null then null else private.attempt_for_learner(v_last) end,
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id, 'kind', q.kind, 'prompt', q.prompt, 'points', q.points,
        'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o -> 'id', 'label', o -> 'label') order by ord), '[]'::jsonb)
                    from jsonb_array_elements(q.options) with ordinality as t(o, ord))
      ) order by q.position), '[]'::jsonb)
      from public.quiz_questions q where q.content_id = p_content
    )
  );
end;
$$;
revoke all on function public.get_quiz(uuid) from public;
grant execute on function public.get_quiz(uuid) to authenticated;

-- Marca a avaliação como concluída para a pessoa e recalcula as trilhas.
create or replace function private.complete_quiz_for(p_profile uuid, p_content uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.content_progress (profile_id, content_id, status, completed_at, completion_mode, visits)
  values (p_profile, p_content, 'concluido', now(), 'confirmada', 1)
  on conflict (profile_id, content_id)
  do update set status = 'concluido',
                completed_at = coalesce(public.content_progress.completed_at, now()),
                completion_mode = coalesce(public.content_progress.completion_mode, 'confirmada');
  perform private.recompute_for_content(p_profile, p_content);
end;
$$;

-- Envia as respostas. p_answers: {"<question_id>": {"options": ["id", ...], "text": "..."}}
create or replace function public.submit_quiz(p_content uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contents;
  q public.quiz_questions;
  v_used integer;
  v_items jsonb := '[]'::jsonb;
  v_sel jsonb;
  v_text text;
  v_correct_ids jsonb;
  v_ok boolean;
  v_awarded numeric := 0;
  v_total integer := 0;
  v_open boolean := false;
  v_score numeric;
  v_status text;
  v_id uuid;
begin
  if auth.uid() is null or not public.can_view_content(p_content) then
    raise exception 'Avaliação não disponível para você.' using errcode = '42501';
  end if;
  select * into c from public.contents where id = p_content for share;
  if c.kind::text <> 'avaliacao' then
    raise exception 'Este conteúdo não é uma avaliação.' using errcode = '22023';
  end if;
  if not public.content_unlocked(p_content) then
    raise exception 'Conclua as etapas anteriores da trilha antes desta.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.quiz_attempts where profile_id = auth.uid() and content_id = p_content and status = 'aprovada') then
    raise exception 'Você já foi aprovado nesta avaliação.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.quiz_attempts where profile_id = auth.uid() and content_id = p_content and status = 'em_correcao') then
    raise exception 'Sua tentativa anterior ainda está em correção.' using errcode = 'P0001';
  end if;
  select count(*) into v_used from public.quiz_attempts where profile_id = auth.uid() and content_id = p_content;
  if c.max_attempts is not null and v_used >= c.max_attempts then
    raise exception 'Você usou todas as tentativas desta avaliação. Fale com o seu gestor.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object' then
    raise exception 'Respostas inválidas.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.quiz_questions where content_id = p_content) then
    raise exception 'Esta avaliação ainda não tem perguntas.' using errcode = 'P0001';
  end if;

  for q in select * from public.quiz_questions where content_id = p_content order by position
  loop
    v_total := v_total + q.points;
    v_sel := coalesce(p_answers -> q.id::text -> 'options', '[]'::jsonb);
    if jsonb_typeof(v_sel) <> 'array' then v_sel := '[]'::jsonb; end if;
    v_text := left(btrim(coalesce(p_answers -> q.id::text ->> 'text', '')), 5000);

    if q.kind = 'aberta' then
      v_open := true;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'question_id', q.id, 'kind', q.kind, 'prompt', q.prompt, 'explanation', q.explanation, 'points', q.points,
        'options', '[]'::jsonb, 'text', v_text, 'awarded', null, 'correct', null, 'comment', null));
    else
      select coalesce(jsonb_agg(o -> 'id' order by o ->> 'id'), '[]'::jsonb) into v_correct_ids
      from jsonb_array_elements(q.options) o where (o ->> 'correct')::boolean;
      -- Acerto = exatamente as alternativas corretas (sem faltar nem sobrar).
      v_ok := v_correct_ids = (
        select coalesce(jsonb_agg(s order by s #>> '{}'), '[]'::jsonb)
        from (select distinct value as s from jsonb_array_elements(v_sel)
              where value #>> '{}' in (select o ->> 'id' from jsonb_array_elements(q.options) o)) d
      );
      if v_ok then v_awarded := v_awarded + q.points; end if;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'question_id', q.id, 'kind', q.kind, 'prompt', q.prompt, 'explanation', q.explanation, 'points', q.points,
        'options', (select jsonb_agg(jsonb_build_object('id', o -> 'id', 'label', o -> 'label', 'correct', o -> 'correct',
                                                        'selected', v_sel @> jsonb_build_array(o -> 'id')) order by ord)
                    from jsonb_array_elements(q.options) with ordinality as t(o, ord)),
        'text', null, 'awarded', case when v_ok then q.points else 0 end, 'correct', v_ok, 'comment', null));
    end if;
  end loop;

  v_score := round(100.0 * v_awarded / greatest(v_total, 1), 2);
  v_status := case when v_open then 'em_correcao' when v_score >= c.passing_score then 'aprovada' else 'reprovada' end;

  insert into public.quiz_attempts (profile_id, content_id, status, score, points_awarded, points_total, passing_score, answers)
  values (auth.uid(), p_content, v_status, v_score, v_awarded, v_total, c.passing_score, v_items)
  returning id into v_id;

  if v_status = 'aprovada' then
    perform private.complete_quiz_for(auth.uid(), p_content);
  else
    -- Registra que a pessoa já começou a etapa (conta como "em andamento").
    insert into public.content_progress (profile_id, content_id, visits) values (auth.uid(), p_content, 1)
    on conflict (profile_id, content_id) do nothing;
    perform private.recompute_for_content(auth.uid(), p_content);
  end if;

  return jsonb_build_object('id', v_id, 'status', v_status, 'score', v_score);
end;
$$;
revoke all on function public.submit_quiz(uuid, jsonb) from public;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;

-- Correção das respostas abertas. p_grades: {"<question_id>": {"awarded": n, "comment": "..."}}
create or replace function public.grade_quiz_attempt(p_attempt uuid, p_grades jsonb, p_feedback text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.quiz_attempts;
  v_items jsonb := '[]'::jsonb;
  x jsonb;
  g jsonb;
  v_aw numeric;
  v_awarded numeric := 0;
  v_score numeric;
  v_status text;
begin
  select * into a from public.quiz_attempts where id = p_attempt for update;
  if a.id is null then
    raise exception 'Tentativa não encontrada.' using errcode = 'P0002';
  end if;
  if not public.has_permission('avaliacoes.corrigir') or a.profile_id = auth.uid() or not public.can_view_progress_of(a.profile_id) then
    raise exception 'Você não pode corrigir esta avaliação.' using errcode = '42501';
  end if;
  if a.status <> 'em_correcao' then
    raise exception 'Esta tentativa já foi corrigida.' using errcode = 'P0001';
  end if;

  for x in select value from jsonb_array_elements(a.answers)
  loop
    if x ->> 'kind' = 'aberta' then
      g := p_grades -> (x ->> 'question_id');
      if g is null or jsonb_typeof(g -> 'awarded') <> 'number' then
        raise exception 'Dê a nota de todas as respostas abertas.' using errcode = '22023';
      end if;
      v_aw := (g ->> 'awarded')::numeric;
      if v_aw < 0 or v_aw > (x ->> 'points')::numeric then
        raise exception 'A nota de cada resposta vai de 0 ao valor da pergunta.' using errcode = '22023';
      end if;
      x := x || jsonb_build_object('awarded', v_aw, 'correct', v_aw >= (x ->> 'points')::numeric,
                                   'comment', nullif(left(btrim(coalesce(g ->> 'comment', '')), 1000), ''));
    end if;
    v_awarded := v_awarded + coalesce((x ->> 'awarded')::numeric, 0);
    v_items := v_items || jsonb_build_array(x);
  end loop;

  v_score := round(100.0 * v_awarded / greatest(a.points_total, 1), 2);
  v_status := case when v_score >= a.passing_score then 'aprovada' else 'reprovada' end;

  update public.quiz_attempts
  set answers = v_items, points_awarded = v_awarded, score = v_score, status = v_status,
      graded_by = auth.uid(), graded_at = now(), feedback = nullif(left(btrim(coalesce(p_feedback, '')), 2000), '')
  where id = p_attempt;

  if v_status = 'aprovada' then
    perform private.complete_quiz_for(a.profile_id, a.content_id);
  end if;
  return jsonb_build_object('status', v_status, 'score', v_score);
end;
$$;
revoke all on function public.grade_quiz_attempt(uuid, jsonb, text) from public;
grant execute on function public.grade_quiz_attempt(uuid, jsonb, text) to authenticated;

-- "Marcar como concluído" não vale para avaliação: só a aprovação conclui.
create or replace function public.complete_content(p_content uuid, p_mode text default 'confirmada')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_mode not in ('confirmada', 'externa_declarada') then
    raise exception 'Modo de conclusão inválido.' using errcode = '22023';
  end if;
  if auth.uid() is null or not public.can_view_content(p_content) then
    raise exception 'Conteúdo não disponível para você.' using errcode = '42501';
  end if;
  if exists (select 1 from public.contents where id = p_content and kind::text = 'avaliacao') then
    raise exception 'A avaliação é concluída quando você é aprovado nela.' using errcode = 'P0001';
  end if;
  if not public.content_unlocked(p_content) then
    raise exception 'Conclua as etapas anteriores da trilha antes desta.' using errcode = 'P0001';
  end if;

  insert into public.content_progress (profile_id, content_id, status, completed_at, completion_mode, visits)
  values (auth.uid(), p_content, 'concluido', now(), p_mode, 1)
  on conflict (profile_id, content_id)
  do update set status = 'concluido',
                completed_at = coalesce(public.content_progress.completed_at, now()),
                completion_mode = coalesce(public.content_progress.completion_mode, excluded.completion_mode);

  perform private.recompute_for_content(auth.uid(), p_content);
end;
$$;
