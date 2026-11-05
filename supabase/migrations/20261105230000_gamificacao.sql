-- =====================================================================
-- Gamificação: pontos, medalhas e ranking.
--
-- Pontos (gravados pelo banco, cada um uma única vez — dedupe_key):
--   etapa obrigatória 10 · etapa opcional 5 (avaliação não conta como etapa)
--   aprovação em avaliação 20 · +10 se aprovado na primeira tentativa
--   trilha concluída 50 · +25 se concluída até o prazo
-- Medalhas: primeiros passos, trilha concluída, colecionador (3 e 5),
--   nota máxima, de primeira, pontual e constância (5 dias seguidos).
-- Ranking por área (todos veem a própria área; quem acompanha vê todas),
-- no mês atual ou desde o início. O que já foi feito antes entra no cálculo.
-- =====================================================================

create table if not exists public.badges (
  key         text primary key,
  name        text not null,
  description text not null,
  icon        text not null,
  tone        text not null,
  sort_order  integer not null default 0
);
insert into public.badges (key, name, description, icon, tone, sort_order) values
  ('primeiros_passos', 'Primeiros passos', 'Concluiu a primeira etapa de uma trilha.', 'footprints', 'blue', 10),
  ('trilha_concluida', 'Trilha concluída', 'Concluiu a primeira trilha.', 'flag', 'teal', 20),
  ('colecionador_3', 'Colecionador', 'Concluiu 3 trilhas.', 'library', 'violet', 30),
  ('colecionador_5', 'Grande colecionador', 'Concluiu 5 trilhas.', 'crown', 'gold', 40),
  ('nota_maxima', 'Nota máxima', 'Tirou 100% numa avaliação.', 'star', 'gold', 50),
  ('de_primeira', 'De primeira', 'Foi aprovado numa avaliação na primeira tentativa.', 'target', 'orange', 60),
  ('pontual', 'Pontual', 'Concluiu uma trilha dentro do prazo.', 'alarm', 'ok', 70),
  ('constancia', 'Constância', 'Estudou 5 dias seguidos.', 'flame', 'pink', 80)
on conflict (key) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, tone = excluded.tone, sort_order = excluded.sort_order;

create table if not exists public.points_ledger (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  points      integer not null check (points > 0),
  reason      text not null check (reason in ('etapa_obrigatoria', 'etapa_opcional', 'avaliacao', 'avaliacao_primeira', 'trilha', 'trilha_no_prazo')),
  description text not null,
  dedupe_key  text not null,
  created_at  timestamptz not null default now(),
  constraint points_ledger_dedupe unique (profile_id, dedupe_key)
);
create index if not exists points_ledger_profile_idx on public.points_ledger (profile_id, created_at desc);
create index if not exists points_ledger_created_idx on public.points_ledger (created_at);

create table if not exists public.user_badges (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  badge_key  text not null references public.badges (key) on delete cascade,
  earned_at  timestamptz not null default now(),
  primary key (profile_id, badge_key)
);

alter table public.badges enable row level security;
alter table public.points_ledger enable row level security;
alter table public.user_badges enable row level security;
revoke all on public.badges, public.points_ledger, public.user_badges from anon, authenticated;
grant select on public.badges, public.points_ledger, public.user_badges to authenticated;
drop policy if exists badges_select on public.badges;
create policy badges_select on public.badges for select to authenticated using (true);
drop policy if exists points_ledger_select on public.points_ledger;
create policy points_ledger_select on public.points_ledger for select to authenticated using (
  public.is_active_user() and (profile_id = auth.uid() or public.can_view_progress_of(profile_id))
);
drop policy if exists user_badges_select on public.user_badges;
create policy user_badges_select on public.user_badges for select to authenticated using (
  public.is_active_user() and (profile_id = auth.uid() or public.can_view_progress_of(profile_id))
);

-- Aviso de medalha no sininho.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in ('matricula', 'prazo_proximo', 'prazo_vencido', 'correcao_pendente', 'avaliacao_corrigida', 'certificado', 'comunicado', 'medalha')
);

create or replace function private.add_points(p_profile uuid, p_points integer, p_reason text, p_description text, p_dedupe text, p_at timestamptz default now())
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  insert into public.points_ledger (profile_id, points, reason, description, dedupe_key, created_at)
  values (p_profile, p_points, p_reason, left(p_description, 200), p_dedupe, coalesce(p_at, now()))
  on conflict (profile_id, dedupe_key) do nothing;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

create or replace function private.award_badge(p_profile uuid, p_badge text, p_at timestamptz default now(), p_notify boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
  v_name text;
begin
  insert into public.user_badges (profile_id, badge_key, earned_at) values (p_profile, p_badge, coalesce(p_at, now()))
  on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n > 0 and p_notify then
    select name into v_name from public.badges where key = p_badge;
    perform private.notify(p_profile, 'medalha', 'Nova medalha: ' || v_name,
      (select description from public.badges where key = p_badge), '/conquistas', 'medalha:' || p_badge);
  end if;
end;
$$;

-- Etapa concluída (texto, vídeo, link, arquivo).
create or replace function private.points_for_content(p_profile uuid, p_content uuid, p_at timestamptz, p_notify boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contents;
  v_required boolean;
begin
  select * into c from public.contents where id = p_content;
  if c.id is null or c.kind::text = 'avaliacao' then
    return;
  end if;
  -- Obrigatória se for obrigatória em alguma trilha em que a pessoa está matriculada.
  select coalesce(bool_or(mi.is_required), false) into v_required
  from public.module_items mi
  join public.modules m on m.id = mi.module_id
  join public.enrollments e on e.track_id = m.track_id and e.profile_id = p_profile
  where mi.content_id = p_content;
  if not exists (
    select 1 from public.module_items mi join public.modules m on m.id = mi.module_id
    join public.enrollments e on e.track_id = m.track_id and e.profile_id = p_profile
    where mi.content_id = p_content
  ) then
    return; -- material avulso (biblioteca) não pontua
  end if;
  perform private.add_points(p_profile, case when v_required then 10 else 5 end,
    case when v_required then 'etapa_obrigatoria' else 'etapa_opcional' end,
    'Etapa concluída: ' || c.title, 'etapa:' || p_content, p_at);
  perform private.award_badge(p_profile, 'primeiros_passos', p_at, p_notify);
end;
$$;

-- Avaliação aprovada.
create or replace function private.points_for_attempt(a public.quiz_attempts, p_notify boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_first boolean;
  v_at timestamptz := coalesce(a.graded_at, a.submitted_at);
begin
  if a.status <> 'aprovada' then
    return;
  end if;
  select title into v_title from public.contents where id = a.content_id;
  perform private.add_points(a.profile_id, 20, 'avaliacao', 'Aprovado em ' || v_title, 'avaliacao:' || a.content_id, v_at);
  select not exists (
    select 1 from public.quiz_attempts x
    where x.profile_id = a.profile_id and x.content_id = a.content_id and x.submitted_at < a.submitted_at
  ) into v_first;
  if v_first then
    perform private.add_points(a.profile_id, 10, 'avaliacao_primeira', 'Aprovado de primeira em ' || v_title, 'primeira:' || a.content_id, v_at);
    perform private.award_badge(a.profile_id, 'de_primeira', v_at, p_notify);
  end if;
  if a.score >= 100 then
    perform private.award_badge(a.profile_id, 'nota_maxima', v_at, p_notify);
  end if;
end;
$$;

-- Trilha concluída.
create or replace function private.points_for_enrollment(e public.enrollments, p_notify boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_at timestamptz := coalesce(e.completed_at, now());
  v_done integer;
begin
  if e.status <> 'concluida' then
    return;
  end if;
  select name into v_name from public.tracks where id = e.track_id;
  perform private.add_points(e.profile_id, 50, 'trilha', 'Trilha concluída: ' || v_name, 'trilha:' || e.track_id, v_at);
  if e.due_date is not null and (v_at at time zone 'America/Sao_Paulo')::date <= e.due_date then
    perform private.add_points(e.profile_id, 25, 'trilha_no_prazo', 'No prazo: ' || v_name, 'prazo:' || e.track_id, v_at);
    perform private.award_badge(e.profile_id, 'pontual', v_at, p_notify);
  end if;
  select count(*) into v_done from public.enrollments where profile_id = e.profile_id and status = 'concluida';
  perform private.award_badge(e.profile_id, 'trilha_concluida', v_at, p_notify);
  if v_done >= 3 then perform private.award_badge(e.profile_id, 'colecionador_3', v_at, p_notify); end if;
  if v_done >= 5 then perform private.award_badge(e.profile_id, 'colecionador_5', v_at, p_notify); end if;
end;
$$;

-- Constância: estudou nos 5 dias que terminam em p_day.
create or replace function private.check_streak(p_profile uuid, p_day date, p_notify boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(distinct (s.started_at at time zone 'America/Sao_Paulo')::date)
    from public.learning_sessions s
    where s.profile_id = p_profile
      and (s.started_at at time zone 'America/Sao_Paulo')::date between p_day - 4 and p_day
  ) >= 5 then
    perform private.award_badge(p_profile, 'constancia', now(), p_notify);
  end if;
end;
$$;

-- Gatilhos.
create or replace function private.gam_content_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'concluido' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform private.points_for_content(new.profile_id, new.content_id, coalesce(new.completed_at, now()));
  end if;
  return new;
end;
$$;
drop trigger if exists content_progress_gamificacao on public.content_progress;
create trigger content_progress_gamificacao after insert or update of status on public.content_progress
  for each row execute function private.gam_content_progress();

create or replace function private.gam_quiz_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'aprovada' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform private.points_for_attempt(new);
  end if;
  return new;
end;
$$;
drop trigger if exists quiz_attempts_gamificacao on public.quiz_attempts;
create trigger quiz_attempts_gamificacao after insert or update of status on public.quiz_attempts
  for each row execute function private.gam_quiz_attempt();

create or replace function private.gam_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'concluida' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform private.points_for_enrollment(new);
  end if;
  return new;
end;
$$;
drop trigger if exists enrollments_gamificacao on public.enrollments;
create trigger enrollments_gamificacao after insert or update of status on public.enrollments
  for each row execute function private.gam_enrollment();

create or replace function private.gam_learning_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.check_streak(new.profile_id, (new.started_at at time zone 'America/Sao_Paulo')::date);
  return new;
end;
$$;
drop trigger if exists learning_sessions_gamificacao on public.learning_sessions;
create trigger learning_sessions_gamificacao after insert on public.learning_sessions
  for each row execute function private.gam_learning_session();

-- Cálculo retroativo (sem avisos): o que já foi concluído antes desta versão.
do $$
declare
  r record;
  a public.quiz_attempts;
  e public.enrollments;
begin
  for r in select profile_id, content_id, completed_at from public.content_progress where status = 'concluido' order by completed_at loop
    perform private.points_for_content(r.profile_id, r.content_id, r.completed_at, false);
  end loop;
  for a in select * from public.quiz_attempts where status = 'aprovada' order by submitted_at loop
    perform private.points_for_attempt(a, false);
  end loop;
  for e in select * from public.enrollments where status = 'concluida' order by completed_at loop
    perform private.points_for_enrollment(e, false);
  end loop;
  for r in select distinct profile_id, (started_at at time zone 'America/Sao_Paulo')::date as d from public.learning_sessions loop
    perform private.check_streak(r.profile_id, r.d, false);
  end loop;
end;
$$;

-- Quem enxerga todas as áreas no ranking.
create or replace function private.sees_all_areas()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission('progresso.ver') or public.has_permission('equipe.ver');
$$;

-- Ranking de uma área (null = a própria). Mês atual ou desde o início.
create or replace function public.points_ranking(p_area uuid default null, p_month boolean default false)
returns table (profile_id uuid, full_name text, avatar_path text, area_name text, points integer, badges integer, rank integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_my_area uuid;
  v_area uuid;
  v_since timestamptz := case when p_month then date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' else '-infinity'::timestamptz end;
begin
  if auth.uid() is null or not public.is_active_user() then
    return;
  end if;
  select area_id into v_my_area from public.profiles where id = auth.uid();
  v_area := coalesce(p_area, v_my_area);
  if v_area is distinct from v_my_area and not private.sees_all_areas() then
    raise exception 'Você vê apenas o ranking da sua área.' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, p.avatar_path, ar.name,
           coalesce(sum(l.points), 0)::int as pts,
           (select count(*)::int from public.user_badges b where b.profile_id = p.id),
           (rank() over (order by coalesce(sum(l.points), 0) desc))::int
    from public.profiles p
    left join public.areas ar on ar.id = p.area_id
    left join public.points_ledger l on l.profile_id = p.id and l.created_at >= v_since
    where p.status <> 'inativo'
      and (p.area_id = v_area or (v_area is null and p.area_id is null and p.id = auth.uid()))
    group by p.id, p.full_name, p.avatar_path, ar.name
    order by pts desc, p.full_name
    limit 200;
end;
$$;

-- Resumo da própria pessoa: pontos (total e mês) e posição na área.
create or replace function public.my_gamification()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_month integer;
  v_rank_total integer;
  v_rank_month integer;
  v_size integer;
begin
  if auth.uid() is null then
    return null;
  end if;
  select coalesce(sum(points), 0) into v_total from public.points_ledger where profile_id = auth.uid();
  select coalesce(sum(points), 0) into v_month from public.points_ledger
   where profile_id = auth.uid() and created_at >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  select r.rank into v_rank_total from public.points_ranking(null, false) r where r.profile_id = auth.uid();
  select r.rank into v_rank_month from public.points_ranking(null, true) r where r.profile_id = auth.uid();
  select count(*) into v_size from public.points_ranking(null, false);
  return jsonb_build_object('total', v_total, 'month', v_month, 'rank_total', v_rank_total, 'rank_month', v_rank_month, 'area_size', v_size,
    'badges', (select count(*) from public.user_badges where profile_id = auth.uid()),
    'badges_total', (select count(*) from public.badges));
end;
$$;

revoke all on function public.points_ranking(uuid, boolean), public.my_gamification() from public;
grant execute on function public.points_ranking(uuid, boolean), public.my_gamification() to authenticated;
