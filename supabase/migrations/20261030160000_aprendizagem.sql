-- =====================================================================
-- Etapa 2 · Gestão de aprendizagem
-- Conteúdos, trilhas, módulos, público-alvo, matrículas, progresso e
-- tempo de estudo. Arquivos enviados ficam no Storage (bucket privado).
-- =====================================================================

create type public.publish_status as enum ('rascunho', 'publicado', 'arquivado');
create type public.content_kind as enum ('texto', 'link', 'video', 'arquivo');
create type public.enrollment_status as enum ('nao_iniciada', 'em_andamento', 'concluida');
create type public.progress_status as enum ('em_andamento', 'concluido');

-- ---------------------------------------------------------------------
-- Conteúdos
-- ---------------------------------------------------------------------

create table public.contents (
  id                uuid primary key default gen_random_uuid(),
  title             text not null check (length(btrim(title)) between 3 and 160),
  description       text,
  category          text check (category is null or length(btrim(category)) between 2 and 60),
  kind              public.content_kind not null,
  body              text,
  url               text check (url is null or url ~* '^https?://'),
  storage_path      text,
  file_name         text,
  file_size         bigint check (file_size is null or file_size > 0),
  mime_type         text,
  external_platform text,
  access_note       text,
  objective         text,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 1 and 1440),
  owner_id          uuid references public.profiles (id) on delete set null,
  is_library        boolean not null default false,
  status            public.publish_status not null default 'rascunho',
  created_by        uuid default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint contents_kind_fields check (
    (kind = 'texto' and body is not null and length(btrim(body)) > 0)
    or (kind in ('link', 'video') and url is not null)
    or (kind = 'arquivo' and storage_path is not null)
  )
);
comment on column public.contents.is_library is 'Aparece na biblioteca de materiais para o público definido, além das trilhas.';
comment on column public.contents.access_note is 'Instruções de acesso (ex.: login de plataforma externa). Visível só para quem pode ver o conteúdo.';
create index contents_status_idx on public.contents (status);
create index contents_category_idx on public.contents (category);

-- ---------------------------------------------------------------------
-- Trilhas e módulos
-- ---------------------------------------------------------------------

create table public.tracks (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null check (length(btrim(name)) between 3 and 120),
  description          text,
  objective            text,
  audience_note        text,
  recommended_level_id uuid references public.levels (id) on delete set null,
  is_mandatory         boolean not null default false,
  deadline_days        integer check (deadline_days is null or deadline_days between 1 and 365),
  is_sequential        boolean not null default true,
  status               public.publish_status not null default 'rascunho',
  published_at         timestamptz,
  created_by           uuid default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create unique index tracks_name_key on public.tracks (lower(btrim(name)));

create table public.modules (
  id          uuid primary key default gen_random_uuid(),
  track_id    uuid not null references public.tracks (id) on delete cascade,
  title       text not null check (length(btrim(title)) between 2 and 120),
  description text,
  position    integer not null check (position > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint modules_position_key unique (track_id, position) deferrable initially deferred
);

create table public.module_items (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references public.modules (id) on delete cascade,
  content_id  uuid not null references public.contents (id) on delete restrict,
  position    integer not null check (position > 0),
  is_required boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint module_items_content_key unique (module_id, content_id),
  constraint module_items_position_key unique (module_id, position) deferrable initially deferred
);
create index module_items_content_idx on public.module_items (content_id);

-- ---------------------------------------------------------------------
-- Público-alvo: uma regra combina área, cargo e nível (campos vazios
-- valem para todos). Sem regras = ninguém além dos gestores.
-- ---------------------------------------------------------------------

create table public.audience_rules (
  id          uuid primary key default gen_random_uuid(),
  track_id    uuid references public.tracks (id) on delete cascade,
  content_id  uuid references public.contents (id) on delete cascade,
  area_id     uuid references public.areas (id) on delete cascade,
  position_id uuid references public.positions (id) on delete cascade,
  level_id    uuid references public.levels (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint audience_rules_one_target check ((track_id is null) <> (content_id is null))
);
create index audience_rules_track_idx on public.audience_rules (track_id);
create index audience_rules_content_idx on public.audience_rules (content_id);

-- ---------------------------------------------------------------------
-- Matrículas, progresso e sessões de estudo
-- ---------------------------------------------------------------------

create table public.enrollments (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.profiles (id) on delete restrict,
  track_id         uuid not null references public.tracks (id) on delete restrict,
  origin           text not null default 'manual' check (origin in ('automatica', 'manual', 'propria')),
  assigned_by      uuid,
  assigned_at      timestamptz not null default now(),
  due_date         date,
  status           public.enrollment_status not null default 'nao_iniciada',
  progress_percent numeric(5, 2) not null default 0 check (progress_percent between 0 and 100),
  started_at       timestamptz,
  completed_at     timestamptz,
  constraint enrollments_unique unique (profile_id, track_id)
);
create index enrollments_track_idx on public.enrollments (track_id);
create index enrollments_status_idx on public.enrollments (status, due_date);

create table public.content_progress (
  profile_id      uuid not null references public.profiles (id) on delete restrict,
  content_id      uuid not null references public.contents (id) on delete restrict,
  status          public.progress_status not null default 'em_andamento',
  first_opened_at timestamptz not null default now(),
  last_opened_at  timestamptz not null default now(),
  completed_at    timestamptz,
  completion_mode text check (completion_mode in ('confirmada', 'externa_declarada')),
  visits          integer not null default 0,
  active_seconds  integer not null default 0,
  session_seconds integer not null default 0,
  primary key (profile_id, content_id)
);
create index content_progress_content_idx on public.content_progress (content_id);

create table public.learning_sessions (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles (id) on delete restrict,
  content_id      uuid not null references public.contents (id) on delete restrict,
  started_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  active_seconds  integer not null default 0,
  session_seconds integer not null default 0
);
create index learning_sessions_profile_idx on public.learning_sessions (profile_id, started_at desc);
create index learning_sessions_content_idx on public.learning_sessions (content_id);

-- ---------------------------------------------------------------------
-- Funções de acesso
-- ---------------------------------------------------------------------

-- O colaborador logado atende a alguma regra de público do alvo?
create or replace function public.matches_audience(p_track uuid, p_content uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.audience_rules r
    join public.profiles p on p.id = auth.uid() and p.status <> 'inativo'
    where (r.track_id = p_track or r.content_id = p_content)
      and (r.area_id is null or r.area_id = p.area_id)
      and (r.position_id is null or r.position_id = p.position_id)
      and (r.level_id is null or r.level_id = p.level_id)
  );
$$;

create or replace function private.profile_matches_track(p_profile uuid, p_track uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.audience_rules r
    join public.profiles p on p.id = p_profile and p.status <> 'inativo'
    where r.track_id = p_track
      and (r.area_id is null or r.area_id = p.area_id)
      and (r.position_id is null or r.position_id = p.position_id)
      and (r.level_id is null or r.level_id = p.level_id)
  );
$$;

create or replace function public.can_view_track(p_track uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission('trilhas.gerenciar')
      or public.has_permission('progresso.ver')
      or public.has_permission('equipe.ver')
      or exists (
        select 1 from public.tracks t
        where t.id = p_track and t.status = 'publicado' and public.is_active_user()
          and (
            exists (select 1 from public.enrollments e where e.track_id = t.id and e.profile_id = auth.uid())
            or public.matches_audience(t.id, null)
          )
      );
$$;

create or replace function public.can_view_content(p_content uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission('conteudos.gerenciar')
      or public.has_permission('trilhas.gerenciar')
      or exists (
        select 1 from public.contents c
        where c.id = p_content and c.status = 'publicado' and public.is_active_user()
          and (
            exists (
              select 1
              from public.module_items mi
              join public.modules m on m.id = mi.module_id
              join public.tracks t on t.id = m.track_id and t.status = 'publicado'
              join public.enrollments e on e.track_id = t.id and e.profile_id = auth.uid()
              where mi.content_id = c.id
            )
            or (c.is_library and public.matches_audience(null, c.id))
          )
      );
$$;

-- Equipe: o supervisor pode ver o progresso de quem ele acompanha.
create or replace function public.can_view_progress_of(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile = auth.uid()
      or public.has_permission('progresso.ver')
      or public.has_permission('trilhas.gerenciar')
      or (public.has_permission('equipe.ver')
          and exists (select 1 from public.profiles where id = p_profile and supervisor_id = auth.uid()));
$$;

-- ---------------------------------------------------------------------
-- Matrícula automática nas trilhas obrigatórias
-- ---------------------------------------------------------------------

-- Matricula quem atende ao público das trilhas obrigatórias publicadas.
-- Nunca remove matrículas: quem mudou de área mantém o histórico.
create or replace function private.sync_mandatory_enrollments(p_track uuid, p_profile uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.enrollments (profile_id, track_id, origin, assigned_by, due_date)
  select p.id, t.id, 'automatica', auth.uid(),
         case when t.deadline_days is null then null
              else greatest(current_date, coalesce(p.onboarding_start_date, current_date)) + t.deadline_days end
  from public.tracks t
  cross join public.profiles p
  where t.status = 'publicado' and t.is_mandatory
    and p.status <> 'inativo'
    and (p_track is null or t.id = p_track)
    and (p_profile is null or p.id = p_profile)
    and private.profile_matches_track(p.id, t.id)
  on conflict (profile_id, track_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function private.on_track_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'publicado' and (tg_op = 'INSERT' or old.status is distinct from 'publicado') then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

create or replace function private.after_track_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'publicado' and new.is_mandatory then
    perform private.sync_mandatory_enrollments(new.id, null);
  end if;
  return null;
end;
$$;

create or replace function private.after_audience_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_track uuid := coalesce(new.track_id, old.track_id);
begin
  if v_track is not null then
    perform private.sync_mandatory_enrollments(v_track, null);
  end if;
  return null;
end;
$$;

create or replace function private.after_profile_structure_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_mandatory_enrollments(null, new.id);
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Progresso
-- ---------------------------------------------------------------------

create or replace function private.recompute_enrollment(p_enrollment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
  v_track uuid;
  v_total integer;
  v_done integer;
  v_percent numeric(5, 2);
  v_any boolean;
begin
  select profile_id, track_id into v_profile, v_track from public.enrollments where id = p_enrollment;
  if v_profile is null then
    return;
  end if;

  select count(*),
         count(*) filter (where cp.status = 'concluido')
    into v_total, v_done
  from public.module_items mi
  join public.modules m on m.id = mi.module_id and m.track_id = v_track
  left join public.content_progress cp on cp.content_id = mi.content_id and cp.profile_id = v_profile
  where mi.is_required;

  v_percent := case when v_total = 0 then 0 else round(100.0 * v_done / v_total, 2) end;

  select exists (
    select 1 from public.content_progress cp
    join public.module_items mi on mi.content_id = cp.content_id
    join public.modules m on m.id = mi.module_id and m.track_id = v_track
    where cp.profile_id = v_profile
  ) into v_any;

  update public.enrollments e
  set progress_percent = v_percent,
      status = case
        when v_total > 0 and v_done = v_total then 'concluida'::public.enrollment_status
        when v_any then 'em_andamento'::public.enrollment_status
        else 'nao_iniciada'::public.enrollment_status
      end,
      started_at = case when v_any then coalesce(e.started_at, now()) else e.started_at end,
      completed_at = case when v_total > 0 and v_done = v_total then coalesce(e.completed_at, now()) else null end
  where e.id = p_enrollment;
end;
$$;

-- Recalcula as matrículas da pessoa nas trilhas que contêm o conteúdo.
create or replace function private.recompute_for_content(p_profile uuid, p_content uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in
    select distinct e.id
    from public.enrollments e
    join public.modules m on m.track_id = e.track_id
    join public.module_items mi on mi.module_id = m.id and mi.content_id = p_content
    where e.profile_id = p_profile
  loop
    perform private.recompute_enrollment(v_id);
  end loop;
end;
$$;

-- Estrutura da trilha mudou: recalcula todas as matrículas dela.
create or replace function private.after_structure_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_track uuid;
  v_id uuid;
begin
  if tg_table_name = 'module_items' then
    select track_id into v_track from public.modules where id = coalesce(new.module_id, old.module_id);
  else
    v_track := coalesce(new.track_id, old.track_id);
  end if;
  if v_track is null then
    return null;
  end if;
  for v_id in select id from public.enrollments where track_id = v_track loop
    perform private.recompute_enrollment(v_id);
  end loop;
  return null;
end;
$$;

-- O conteúdo pode ser concluído agora? Em trilha sequencial, todos os
-- itens obrigatórios anteriores precisam estar concluídos. Itens
-- opcionais (materiais de consulta) ficam sempre liberados.
create or replace function public.content_unlocked(p_content uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_view_content(p_content) and (
    -- conteúdo de biblioteca ou de trilha não sequencial
    not exists (
      select 1
      from public.module_items mi
      join public.modules m on m.id = mi.module_id
      join public.tracks t on t.id = m.track_id and t.is_sequential
      join public.enrollments e on e.track_id = t.id and e.profile_id = auth.uid()
      where mi.content_id = p_content
    )
    or exists (
      select 1
      from public.module_items mi
      join public.modules m on m.id = mi.module_id
      join public.tracks t on t.id = m.track_id
      join public.enrollments e on e.track_id = t.id and e.profile_id = auth.uid()
      where mi.content_id = p_content
        and (
          not t.is_sequential
          or not mi.is_required
          or not exists (
            select 1
            from public.module_items prev
            join public.modules pm on pm.id = prev.module_id and pm.track_id = t.id
            left join public.content_progress cp on cp.content_id = prev.content_id and cp.profile_id = auth.uid()
            where prev.is_required
              and (pm.position < m.position or (pm.id = m.id and prev.position < mi.position))
              and coalesce(cp.status::text, '') <> 'concluido'
          )
        )
    )
  );
$$;

-- Abre uma sessão de estudo. Devolve o id da sessão.
create or replace function public.start_learning_session(p_content uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid;
begin
  if auth.uid() is null or not public.can_view_content(p_content) then
    raise exception 'Conteúdo não disponível para você.' using errcode = '42501';
  end if;

  insert into public.content_progress (profile_id, content_id, visits)
  values (auth.uid(), p_content, 1)
  on conflict (profile_id, content_id)
  do update set visits = public.content_progress.visits + 1, last_opened_at = now();

  insert into public.learning_sessions (profile_id, content_id)
  values (auth.uid(), p_content)
  returning id into v_session;

  perform private.recompute_for_content(auth.uid(), p_content);
  return v_session;
end;
$$;

-- Registra tempo. Tempo ativo só conta com a página visível e com
-- interação recente (medido no navegador) e nunca passa do tempo real
-- decorrido desde o último registro.
create or replace function public.ping_learning_session(p_session uuid, p_active_seconds integer, p_session_seconds integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.learning_sessions;
  v_elapsed integer;
  v_active integer;
  v_total integer;
begin
  select * into v_row from public.learning_sessions where id = p_session and profile_id = auth.uid();
  if v_row.id is null then
    raise exception 'Sessão não encontrada.' using errcode = 'P0002';
  end if;
  v_elapsed := greatest(0, ceil(extract(epoch from now() - v_row.last_seen_at))::integer) + 5;
  v_total := least(greatest(coalesce(p_session_seconds, 0), 0), v_elapsed, 300);
  v_active := least(greatest(coalesce(p_active_seconds, 0), 0), v_total);

  update public.learning_sessions
  set last_seen_at = now(),
      active_seconds = active_seconds + v_active,
      session_seconds = session_seconds + v_total
  where id = p_session;

  update public.content_progress
  set active_seconds = active_seconds + v_active,
      session_seconds = session_seconds + v_total
  where profile_id = auth.uid() and content_id = v_row.content_id;
end;
$$;

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

-- Inscrição pela própria pessoa em trilha opcional do seu público.
create or replace function public.enroll_me(p_track uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_deadline integer;
begin
  if not exists (select 1 from public.tracks where id = p_track and status = 'publicado')
     or not public.matches_audience(p_track, null) then
    raise exception 'Esta trilha não está disponível para você.' using errcode = '42501';
  end if;
  select deadline_days into v_deadline from public.tracks where id = p_track;
  insert into public.enrollments (profile_id, track_id, origin, assigned_by, due_date)
  values (auth.uid(), p_track, 'propria', auth.uid(), case when v_deadline is null then null else current_date + v_deadline end)
  on conflict (profile_id, track_id) do update set profile_id = excluded.profile_id
  returning id into v_id;
  return v_id;
end;
$$;

-- Move um módulo ou item uma posição para cima (-1) ou para baixo (+1).
create or replace function public.move_module(p_module uuid, p_direction integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_track uuid;
  v_pos integer;
  v_other uuid;
  v_other_pos integer;
begin
  select track_id, position into v_track, v_pos from public.modules where id = p_module;
  if v_track is null then
    raise exception 'Módulo não encontrado.' using errcode = 'P0002';
  end if;
  select id, position into v_other, v_other_pos from public.modules
  where track_id = v_track and (case when p_direction < 0 then position < v_pos else position > v_pos end)
  order by case when p_direction < 0 then -position else position end
  limit 1;
  if v_other is null then return; end if;
  update public.modules set position = v_other_pos where id = p_module;
  update public.modules set position = v_pos where id = v_other;
end;
$$;

create or replace function public.move_module_item(p_item uuid, p_direction integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_module uuid;
  v_pos integer;
  v_other uuid;
  v_other_pos integer;
begin
  select module_id, position into v_module, v_pos from public.module_items where id = p_item;
  if v_module is null then
    raise exception 'Item não encontrado.' using errcode = 'P0002';
  end if;
  select id, position into v_other, v_other_pos from public.module_items
  where module_id = v_module and (case when p_direction < 0 then position < v_pos else position > v_pos end)
  order by case when p_direction < 0 then -position else position end
  limit 1;
  if v_other is null then return; end if;
  update public.module_items set position = v_other_pos where id = p_item;
  update public.module_items set position = v_pos where id = v_other;
end;
$$;

-- ---------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------

create trigger contents_updated_at before update on public.contents for each row execute function private.set_updated_at();
create trigger tracks_updated_at   before update on public.tracks   for each row execute function private.set_updated_at();
create trigger modules_updated_at  before update on public.modules  for each row execute function private.set_updated_at();

create trigger tracks_publish before insert or update on public.tracks
  for each row execute function private.on_track_change();
create trigger tracks_sync after insert or update of status, is_mandatory, deadline_days on public.tracks
  for each row execute function private.after_track_change();
create trigger audience_sync after insert or update or delete on public.audience_rules
  for each row execute function private.after_audience_change();
create trigger profiles_sync_enrollments after insert or update of area_id, position_id, level_id, status on public.profiles
  for each row execute function private.after_profile_structure_change();
create trigger module_items_recompute after insert or update or delete on public.module_items
  for each row execute function private.after_structure_change();
create trigger enrollments_recompute after insert on public.enrollments
  for each row execute function private.after_structure_change();

create trigger contents_audit       after insert or update or delete on public.contents       for each row execute function private.write_audit_log();
create trigger tracks_audit         after insert or update or delete on public.tracks         for each row execute function private.write_audit_log();
create trigger modules_audit        after insert or update or delete on public.modules        for each row execute function private.write_audit_log();
create trigger module_items_audit   after insert or update or delete on public.module_items   for each row execute function private.write_audit_log();
create trigger audience_rules_audit after insert or update or delete on public.audience_rules for each row execute function private.write_audit_log();
create trigger enrollments_audit    after insert or delete on public.enrollments              for each row execute function private.write_audit_log();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.contents          enable row level security;
alter table public.tracks            enable row level security;
alter table public.modules           enable row level security;
alter table public.module_items      enable row level security;
alter table public.audience_rules    enable row level security;
alter table public.enrollments       enable row level security;
alter table public.content_progress  enable row level security;
alter table public.learning_sessions enable row level security;

-- Supervisores e quem acompanha o progresso também leem os conteúdos,
-- para ver o nome do que cada pessoa estudou.
create policy contents_select on public.contents for select to authenticated using (
  public.can_view_content(id)
  or (public.is_active_user() and (public.has_permission('progresso.ver') or public.has_permission('equipe.ver')))
);
create policy contents_write  on public.contents for all to authenticated
  using (public.has_permission('conteudos.gerenciar')) with check (public.has_permission('conteudos.gerenciar'));

create policy tracks_select on public.tracks for select to authenticated using (public.can_view_track(id));
create policy tracks_write  on public.tracks for all to authenticated
  using (public.has_permission('trilhas.gerenciar')) with check (public.has_permission('trilhas.gerenciar'));

create policy modules_select on public.modules for select to authenticated using (public.can_view_track(track_id));
create policy modules_write  on public.modules for all to authenticated
  using (public.has_permission('trilhas.gerenciar')) with check (public.has_permission('trilhas.gerenciar'));

create policy module_items_select on public.module_items for select to authenticated
  using (exists (select 1 from public.modules m where m.id = module_id and public.can_view_track(m.track_id)));
create policy module_items_write on public.module_items for all to authenticated
  using (public.has_permission('trilhas.gerenciar')) with check (public.has_permission('trilhas.gerenciar'));

create policy audience_rules_select on public.audience_rules for select to authenticated
  using (public.has_permission('trilhas.gerenciar') or public.has_permission('conteudos.gerenciar'));
create policy audience_rules_write on public.audience_rules for all to authenticated
  using (
    (track_id is not null and public.has_permission('trilhas.gerenciar'))
    or (content_id is not null and public.has_permission('conteudos.gerenciar'))
  )
  with check (
    (track_id is not null and public.has_permission('trilhas.gerenciar'))
    or (content_id is not null and public.has_permission('conteudos.gerenciar'))
  );

create policy enrollments_select on public.enrollments for select to authenticated
  using (public.can_view_progress_of(profile_id));
create policy enrollments_write on public.enrollments for all to authenticated
  using (public.has_permission('trilhas.gerenciar')) with check (public.has_permission('trilhas.gerenciar'));

create policy content_progress_select on public.content_progress for select to authenticated
  using (public.can_view_progress_of(profile_id));
create policy learning_sessions_select on public.learning_sessions for select to authenticated
  using (public.can_view_progress_of(profile_id));
-- Progresso e sessões só são gravados pelas funções acima.

-- ---------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------

revoke all on public.contents, public.tracks, public.modules, public.module_items, public.audience_rules,
              public.enrollments, public.content_progress, public.learning_sessions from anon;
revoke truncate, references, trigger on public.contents, public.tracks, public.modules, public.module_items,
              public.audience_rules, public.enrollments, public.content_progress, public.learning_sessions from authenticated;
grant select, insert, update, delete on public.contents, public.tracks, public.modules, public.module_items,
              public.audience_rules, public.enrollments to authenticated;
grant select on public.content_progress, public.learning_sessions to authenticated;
revoke insert, update, delete on public.content_progress, public.learning_sessions from authenticated;

revoke all on function public.matches_audience(uuid, uuid), public.can_view_track(uuid), public.can_view_content(uuid),
  public.can_view_progress_of(uuid), public.content_unlocked(uuid), public.start_learning_session(uuid),
  public.ping_learning_session(uuid, integer, integer), public.complete_content(uuid, text), public.enroll_me(uuid),
  public.move_module(uuid, integer), public.move_module_item(uuid, integer) from anon, public;
grant execute on function public.matches_audience(uuid, uuid), public.can_view_track(uuid), public.can_view_content(uuid),
  public.can_view_progress_of(uuid), public.content_unlocked(uuid), public.start_learning_session(uuid),
  public.ping_learning_session(uuid, integer, integer), public.complete_content(uuid, text), public.enroll_me(uuid),
  public.move_module(uuid, integer), public.move_module_item(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------
-- Permissões da Etapa 2
-- ---------------------------------------------------------------------

insert into public.permissions (key, module, name, description, sort_order) values
  ('trilhas.gerenciar',   'Aprendizagem', 'Gerenciar trilhas e matrículas',   'Cria e publica trilhas, define público e matricula colaboradores.', 60),
  ('conteudos.gerenciar', 'Aprendizagem', 'Gerenciar conteúdos',              'Cria, edita e publica conteúdos e envia arquivos.', 61),
  ('progresso.ver',       'Aprendizagem', 'Ver o progresso de todos',         'Consulta trilhas, progresso e tempo de estudo de todos os colaboradores.', 62)
on conflict (key) do update
  set module = excluded.module, name = excluded.name,
      description = excluded.description, sort_order = excluded.sort_order;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r join public.permissions p on p.key in ('trilhas.gerenciar', 'conteudos.gerenciar', 'progresso.ver')
where r.key = 'admin'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Storage: bucket privado para arquivos de conteúdo (até 50 MB no
-- plano Free do Supabase). Só existe no Supabase; ignorado em testes.
-- ---------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('conteudos', 'conteudos', false, 52428800)
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

    execute $p$
      create policy conteudos_read on storage.objects for select to authenticated
      using (
        bucket_id = 'conteudos'
        and (
          public.has_permission('conteudos.gerenciar')
          or exists (select 1 from public.contents c where c.storage_path = objects.name and public.can_view_content(c.id))
        )
      )
    $p$;
    execute $p$
      create policy conteudos_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'conteudos' and public.has_permission('conteudos.gerenciar'))
    $p$;
    execute $p$
      create policy conteudos_update on storage.objects for update to authenticated
      using (bucket_id = 'conteudos' and public.has_permission('conteudos.gerenciar'))
    $p$;
    execute $p$
      create policy conteudos_delete on storage.objects for delete to authenticated
      using (bucket_id = 'conteudos' and public.has_permission('conteudos.gerenciar'))
    $p$;
  end if;
end;
$$;
