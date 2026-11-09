-- Pesquisa de satisfação.
-- Ao concluir uma trilha, a pessoa avalia de 1 a 5 estrelas, com comentário
-- opcional (pode ser anônimo para o RH). Conteúdos concluídos também podem
-- ser avaliados. O RH vê o relatório por trilha e por conteúdo.

insert into public.permissions (key, module, name, description, sort_order) values
  ('pesquisa.ver', 'Relatórios', 'Ver pesquisa de satisfação', 'Vê as notas e os comentários das avaliações de trilhas e conteúdos, e exporta o relatório.', 85)
on conflict (key) do update set module = excluded.module, name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;

-- ------------------------------------------------------------------ tabelas
create table if not exists public.track_feedback (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references public.enrollments (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  track_id      uuid not null references public.tracks (id) on delete cascade,
  rating        smallint not null check (rating between 1 and 5),
  comment       text check (comment is null or length(comment) <= 1000),
  anonymous     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists track_feedback_track_idx on public.track_feedback (track_id, created_at desc);
create index if not exists track_feedback_profile_idx on public.track_feedback (profile_id);

create table if not exists public.content_feedback (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  content_id  uuid not null references public.contents (id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  comment     text check (comment is null or length(comment) <= 500),
  anonymous   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint content_feedback_unique unique (profile_id, content_id)
);
create index if not exists content_feedback_content_idx on public.content_feedback (content_id, created_at desc);

-- ------------------------------------------------------- aviso no sininho
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in ('matricula', 'prazo_proximo', 'prazo_vencido', 'correcao_pendente', 'avaliacao_corrigida', 'certificado', 'comunicado', 'medalha',
           'equipe_atraso', 'tarefa', 'tarefa_prazo', 'checklist_concluido', 'pesquisa')
);

-- Trilha concluída: convida a pessoa a avaliar (uma vez por matrícula).
create or replace function private.invite_track_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if new.status = 'concluida' and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and not exists (select 1 from public.track_feedback f where f.enrollment_id = new.id) then
    select name into v_name from public.tracks where id = new.track_id;
    perform private.notify(
      new.profile_id, 'pesquisa', 'Como foi a trilha ' || coalesce(v_name, '') || '?',
      'Dê sua nota de 1 a 5 e conte o que achou. Leva menos de um minuto.',
      '/minhas-trilhas/' || new.track_id || '?avaliar=1', 'pesquisa:' || new.id
    );
  end if;
  return new;
end;
$$;
drop trigger if exists enrollments_pesquisa on public.enrollments;
create trigger enrollments_pesquisa after insert or update of status on public.enrollments
  for each row execute function private.invite_track_feedback();

-- Avaliou: o convite some do sininho (marcado como lido).
create or replace function private.after_track_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications set read_at = coalesce(read_at, now())
  where profile_id = new.profile_id and dedupe_key = 'pesquisa:' || new.enrollment_id;
  return new;
end;
$$;
drop trigger if exists track_feedback_after on public.track_feedback;
create trigger track_feedback_after after insert on public.track_feedback
  for each row execute function private.after_track_feedback();

-- --------------------------------------------------------------- envio
create or replace function public.submit_track_feedback(p_track uuid, p_rating integer, p_comment text default null, p_anonymous boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enr public.enrollments;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Entre no sistema para avaliar.' using errcode = '42501';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Escolha uma nota de 1 a 5 estrelas.';
  end if;
  select * into v_enr from public.enrollments where profile_id = auth.uid() and track_id = p_track;
  if v_enr.id is null or v_enr.status <> 'concluida' then
    raise exception 'Você pode avaliar a trilha depois de concluí-la.' using errcode = '42501';
  end if;
  insert into public.track_feedback (enrollment_id, profile_id, track_id, rating, comment, anonymous)
  values (v_enr.id, auth.uid(), p_track, p_rating, nullif(left(btrim(coalesce(p_comment, '')), 1000), ''), coalesce(p_anonymous, false))
  on conflict (enrollment_id) do update
    set rating = excluded.rating, comment = excluded.comment, anonymous = excluded.anonymous, updated_at = now();
end;
$$;

create or replace function public.submit_content_feedback(p_content uuid, p_rating integer, p_comment text default null, p_anonymous boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Entre no sistema para avaliar.' using errcode = '42501';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'Escolha uma nota de 1 a 5 estrelas.';
  end if;
  if not exists (select 1 from public.content_progress where profile_id = auth.uid() and content_id = p_content and status = 'concluido') then
    raise exception 'Você pode avaliar o conteúdo depois de concluí-lo.' using errcode = '42501';
  end if;
  insert into public.content_feedback (profile_id, content_id, rating, comment, anonymous)
  values (auth.uid(), p_content, p_rating, nullif(left(btrim(coalesce(p_comment, '')), 500), ''), coalesce(p_anonymous, false))
  on conflict (profile_id, content_id) do update
    set rating = excluded.rating, comment = excluded.comment, anonymous = excluded.anonymous, updated_at = now();
end;
$$;

-- ------------------------------------------------------------- relatório
-- Período pelas datas da avaliação (horário de São Paulo); área da pessoa.
-- Comentários anônimos saem sem nome. Taxa de resposta = avaliações /
-- trilhas concluídas no mesmo período e área.
create or replace function public.feedback_report(p_from date default null, p_to date default null, p_area uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from date := coalesce(p_from, date '2000-01-01');
  v_to   date := coalesce(p_to, date '2999-12-31');
  v jsonb;
begin
  if not public.has_permission('pesquisa.ver') then
    raise exception 'Sem permissão para ver a pesquisa de satisfação.' using errcode = '42501';
  end if;

  with tf as (
    select f.*, (f.updated_at at time zone 'America/Sao_Paulo')::date as d
    from public.track_feedback f
    join public.profiles p on p.id = f.profile_id
    where (f.updated_at at time zone 'America/Sao_Paulo')::date between v_from and v_to
      and (p_area is null or p.area_id = p_area)
  ),
  cf as (
    select f.*
    from public.content_feedback f
    join public.profiles p on p.id = f.profile_id
    where (f.updated_at at time zone 'America/Sao_Paulo')::date between v_from and v_to
      and (p_area is null or p.area_id = p_area)
  ),
  done as (
    select e.track_id, count(*) as n
    from public.enrollments e
    join public.profiles p on p.id = e.profile_id
    where e.status = 'concluida' and e.completed_at is not null
      and (e.completed_at at time zone 'America/Sao_Paulo')::date between v_from and v_to
      and (p_area is null or p.area_id = p_area)
    group by e.track_id
  ),
  tracks as (
    select t.id, t.name,
      coalesce((select n from done where done.track_id = t.id), 0) as completions,
      count(tf.id) as responses,
      round(avg(tf.rating)::numeric, 2) as avg,
      jsonb_build_array(count(*) filter (where tf.rating = 1), count(*) filter (where tf.rating = 2), count(*) filter (where tf.rating = 3),
                        count(*) filter (where tf.rating = 4), count(*) filter (where tf.rating = 5)) as dist,
      count(tf.comment) as comments
    from public.tracks t
    left join tf on tf.track_id = t.id
    where exists (select 1 from tf x where x.track_id = t.id) or exists (select 1 from done where done.track_id = t.id)
    group by t.id, t.name
  ),
  contents as (
    select c.id, c.title, c.kind::text as kind,
      count(cf.id) as responses,
      round(avg(cf.rating)::numeric, 2) as avg,
      jsonb_build_array(count(*) filter (where cf.rating = 1), count(*) filter (where cf.rating = 2), count(*) filter (where cf.rating = 3),
                        count(*) filter (where cf.rating = 4), count(*) filter (where cf.rating = 5)) as dist,
      count(cf.comment) as comments
    from public.contents c
    join cf on cf.content_id = c.id
    group by c.id, c.title, c.kind
  ),
  comments as (
    select * from (
      select 'trilha' as kind, tf.track_id as item_id, t.name as item, tf.rating, tf.comment, tf.updated_at as at,
        case when tf.anonymous then null else p.full_name end as author,
        case when tf.anonymous then null else a.name end as area
      from tf
      join public.tracks t on t.id = tf.track_id
      join public.profiles p on p.id = tf.profile_id
      left join public.areas a on a.id = p.area_id
      where tf.comment is not null
      union all
      select 'conteudo', cf.content_id, c.title, cf.rating, cf.comment, cf.updated_at,
        case when cf.anonymous then null else p.full_name end,
        case when cf.anonymous then null else a.name end
      from cf
      join public.contents c on c.id = cf.content_id
      join public.profiles p on p.id = cf.profile_id
      left join public.areas a on a.id = p.area_id
      where cf.comment is not null
    ) x
    order by at desc
    limit 300
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'track_responses', (select count(*) from tf),
      'track_avg', (select round(avg(rating)::numeric, 2) from tf),
      'track_dist', (select jsonb_build_array(count(*) filter (where rating = 1), count(*) filter (where rating = 2), count(*) filter (where rating = 3),
                                              count(*) filter (where rating = 4), count(*) filter (where rating = 5)) from tf),
      'completions', (select coalesce(sum(n), 0) from done),
      'content_responses', (select count(*) from cf),
      'content_avg', (select round(avg(rating)::numeric, 2) from cf)
    ),
    'tracks', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'completions', completions, 'responses', responses,
                          'avg', avg, 'dist', dist, 'comments', comments) order by responses desc, name) from tracks), '[]'::jsonb),
    'contents', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'kind', kind, 'responses', responses,
                          'avg', avg, 'dist', dist, 'comments', comments) order by responses desc, title) from contents), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'item_id', item_id, 'item', item, 'rating', rating, 'comment', comment,
                          'at', at, 'author', author, 'area', area) order by at desc) from comments), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

-- -------------------------------------------------------------------- RLS
-- Cada pessoa lê só as próprias avaliações; escrita só pelas funções acima.
-- O RH lê pelo relatório, que esconde o nome nas anônimas.
alter table public.track_feedback enable row level security;
alter table public.content_feedback enable row level security;
revoke all on public.track_feedback, public.content_feedback from anon, authenticated;
grant select on public.track_feedback, public.content_feedback to authenticated;

drop policy if exists track_feedback_select on public.track_feedback;
create policy track_feedback_select on public.track_feedback for select to authenticated using (profile_id = auth.uid());
drop policy if exists content_feedback_select on public.content_feedback;
create policy content_feedback_select on public.content_feedback for select to authenticated using (profile_id = auth.uid());

revoke all on function public.submit_track_feedback(uuid, integer, text, boolean), public.submit_content_feedback(uuid, integer, text, boolean),
  public.feedback_report(date, date, uuid) from public, anon;
grant execute on function public.submit_track_feedback(uuid, integer, text, boolean), public.submit_content_feedback(uuid, integer, text, boolean),
  public.feedback_report(date, date, uuid) to authenticated;
revoke all on function private.invite_track_feedback(), private.after_track_feedback() from public, anon, authenticated;
