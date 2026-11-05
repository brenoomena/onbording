-- =====================================================================
-- Comunicação: central de avisos (sininho) e comunicados.
--
-- * notifications: um aviso por pessoa. Gerados pelo banco (matrícula,
--   correção pendente, avaliação corrigida, certificado, comunicado) e,
--   para prazos, na hora em que a pessoa abre o sistema (sync_my_notifications),
--   sem depender de tarefa agendada. dedupe_key evita repetir o mesmo aviso.
-- * announcements: comunicados do RH/gestão para um público (área, cargo,
--   nível; sem regra = todos). Publicar entrega um aviso a cada pessoa.
-- =====================================================================

-- Permissão para criar e publicar comunicados.
insert into public.permissions (key, module, name, description, sort_order) values
  ('comunicados.gerenciar', 'Comunicação', 'Gerenciar comunicados', 'Cria, publica e arquiva comunicados para um público.', 70)
on conflict (key) do update set module = excluded.module, name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;

-- Permissão de uma pessoa qualquer (mesma regra de has_permission, sem depender da sessão).
create or replace function private.profile_has_permission(p_profile uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = p_profile
      and p.status <> 'inativo'
      and (
        r.key = 'admin'
        or coalesce(
          (select up.allowed from public.user_permissions up where up.profile_id = p.id and up.permission_key = p_key),
          exists (select 1 from public.role_permissions rp where rp.role_id = r.id and rp.permission_key = p_key)
        )
      )
  );
$$;

-- ---------------------------------------------------------------------
-- Comunicados
-- ---------------------------------------------------------------------
create table if not exists public.announcements (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (length(btrim(title)) between 3 and 140),
  body          text not null check (length(btrim(body)) between 1 and 10000),
  importance    text not null default 'normal' check (importance in ('normal', 'importante')),
  status        text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'arquivado')),
  published_at  timestamptz,
  recipients    integer not null default 0,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.announcement_audience (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  area_id         uuid references public.areas (id) on delete cascade,
  position_id     uuid references public.positions (id) on delete cascade,
  level_id        uuid references public.levels (id) on delete cascade
);
create index if not exists announcement_audience_idx on public.announcement_audience (announcement_id);

-- ---------------------------------------------------------------------
-- Avisos
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  kind            text not null check (kind in ('matricula', 'prazo_proximo', 'prazo_vencido', 'correcao_pendente', 'avaliacao_corrigida', 'certificado', 'comunicado')),
  title           text not null,
  body            text,
  link            text check (link is null or link ~ '^/[A-Za-z0-9/_?=&%.-]*$'),
  announcement_id uuid references public.announcements (id) on delete cascade,
  dedupe_key      text,
  created_at      timestamptz not null default now(),
  read_at         timestamptz,
  constraint notifications_dedupe unique (profile_id, dedupe_key)
);
create index if not exists notifications_inbox_idx on public.notifications (profile_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (profile_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated using (profile_id = auth.uid());

alter table public.announcements enable row level security;
alter table public.announcement_audience enable row level security;
revoke all on public.announcements, public.announcement_audience from anon, authenticated;
grant select, insert, update, delete on public.announcements, public.announcement_audience to authenticated;
-- Quem gerencia vê e edita tudo; os demais leem só os publicados que receberam.
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements for select to authenticated using (
  public.has_permission('comunicados.gerenciar')
  or (status = 'publicado' and exists (select 1 from public.notifications n where n.announcement_id = announcements.id and n.profile_id = auth.uid()))
);
drop policy if exists announcements_write on public.announcements;
create policy announcements_write on public.announcements for all to authenticated
  using (public.has_permission('comunicados.gerenciar')) with check (public.has_permission('comunicados.gerenciar'));
drop policy if exists announcement_audience_all on public.announcement_audience;
create policy announcement_audience_all on public.announcement_audience for all to authenticated
  using (public.has_permission('comunicados.gerenciar')) with check (public.has_permission('comunicados.gerenciar'));

create or replace function private.touch_announcement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists announcements_touch on public.announcements;
create trigger announcements_touch before update on public.announcements
  for each row execute function private.touch_announcement();

-- Grava um aviso (ignora repetidos pela dedupe_key).
create or replace function private.notify(p_profile uuid, p_kind text, p_title text, p_body text, p_link text, p_dedupe text, p_announcement uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (profile_id, kind, title, body, link, dedupe_key, announcement_id)
  select p_profile, p_kind, left(p_title, 200), left(p_body, 500), p_link, p_dedupe, p_announcement
  where exists (select 1 from public.profiles where id = p_profile and status <> 'inativo')
  on conflict (profile_id, dedupe_key) do nothing;
$$;

-- Matrícula nova.
create or replace function private.notify_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_track public.tracks;
begin
  select * into v_track from public.tracks where id = new.track_id;
  if v_track.status = 'publicado' then
    perform private.notify(
      new.profile_id, 'matricula', 'Nova trilha: ' || v_track.name,
      case when new.due_date is not null then 'Prazo para concluir: ' || to_char(new.due_date, 'DD/MM/YYYY') || '.' else 'Já está disponível em Minhas trilhas.' end,
      '/minhas-trilhas/' || new.track_id, 'matricula:' || new.id
    );
  end if;
  return new;
end;
$$;
drop trigger if exists enrollments_notify on public.enrollments;
create trigger enrollments_notify after insert on public.enrollments
  for each row execute function private.notify_enrollment();

-- Avaliação enviada com resposta aberta: avisa quem pode corrigir; corrigida: avisa a pessoa.
create or replace function private.notify_quiz_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_name text;
  v_sup uuid;
  v_who uuid;
begin
  select title into v_title from public.contents where id = new.content_id;
  if tg_op = 'INSERT' and new.status = 'em_correcao' then
    select full_name, supervisor_id into v_name, v_sup from public.profiles where id = new.profile_id;
    for v_who in
      select p.id from public.profiles p
      where p.status <> 'inativo' and p.id <> new.profile_id
        and private.profile_has_permission(p.id, 'avaliacoes.corrigir')
        and (p.id = v_sup or private.profile_has_permission(p.id, 'progresso.ver'))
    loop
      perform private.notify(v_who, 'correcao_pendente', 'Avaliação para corrigir', v_name || ' enviou "' || v_title || '".',
        '/acompanhamento/correcao/' || new.id, 'correcao:' || new.id);
    end loop;
  elsif tg_op = 'UPDATE' and old.status = 'em_correcao' and new.status in ('aprovada', 'reprovada') then
    perform private.notify(new.profile_id, 'avaliacao_corrigida',
      case when new.status = 'aprovada' then 'Aprovado em "' || v_title || '"' else 'Avaliação corrigida: "' || v_title || '"' end,
      'Nota ' || round(new.score) || '%.' || case when new.status = 'reprovada' then ' Veja o parecer e tente de novo.' else '' end,
      '/estudar/' || new.content_id, 'corrigida:' || new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists quiz_attempts_notify on public.quiz_attempts;
create trigger quiz_attempts_notify after insert or update of status on public.quiz_attempts
  for each row execute function private.notify_quiz_attempt();

-- Certificado emitido.
create or replace function private.notify_certificate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify(new.profile_id, 'certificado', 'Certificado disponível', 'Você concluiu "' || new.track_name || '". Baixe o certificado.',
    '/certificados/' || new.id, 'certificado:' || new.id);
  return new;
end;
$$;
drop trigger if exists certificates_notify on public.certificates;
create trigger certificates_notify after insert on public.certificates
  for each row execute function private.notify_certificate();

-- Prazos da própria pessoa: chamado quando ela abre o sistema.
create or replace function public.sync_my_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_before integer;
begin
  if auth.uid() is null then
    return 0;
  end if;
  select count(*) into v_before from public.notifications where profile_id = auth.uid();
  for r in
    select e.id, e.due_date, e.track_id, t.name
    from public.enrollments e
    join public.tracks t on t.id = e.track_id and t.status = 'publicado'
    where e.profile_id = auth.uid() and e.status <> 'concluida' and e.due_date is not null
      and e.due_date <= v_today + 3
  loop
    if r.due_date < v_today then
      perform private.notify(auth.uid(), 'prazo_vencido', 'Prazo vencido: ' || r.name,
        'O prazo era ' || to_char(r.due_date, 'DD/MM/YYYY') || '. Conclua assim que puder.', '/minhas-trilhas/' || r.track_id,
        'vencido:' || r.id || ':' || r.due_date);
    else
      perform private.notify(auth.uid(), 'prazo_proximo', 'Prazo chegando: ' || r.name,
        case when r.due_date = v_today then 'Vence hoje.' else 'Vence em ' || to_char(r.due_date, 'DD/MM/YYYY') || '.' end,
        '/minhas-trilhas/' || r.track_id, 'prazo:' || r.id || ':' || r.due_date);
    end if;
  end loop;
  return (select count(*) from public.notifications where profile_id = auth.uid()) - v_before;
end;
$$;

-- Marca como lidos (todos, ou os ids informados).
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language sql
security definer
set search_path = ''
as $$
  with u as (
    update public.notifications set read_at = now()
    where profile_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids))
    returning 1
  )
  select count(*)::int from u;
$$;

-- Publica o comunicado: entrega um aviso a cada pessoa ativa do público.
create or replace function public.publish_announcement(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.announcements;
  v_count integer := 0;
  v_who uuid;
begin
  if not public.has_permission('comunicados.gerenciar') then
    raise exception 'Você não pode publicar comunicados.' using errcode = '42501';
  end if;
  select * into a from public.announcements where id = p_id for update;
  if a.id is null then
    raise exception 'Comunicado não encontrado.' using errcode = 'P0002';
  end if;
  if a.status = 'publicado' then
    raise exception 'Este comunicado já foi publicado.' using errcode = 'P0001';
  end if;
  for v_who in
    select p.id from public.profiles p
    where p.status <> 'inativo'
      and (
        not exists (select 1 from public.announcement_audience x where x.announcement_id = a.id)
        or exists (
          select 1 from public.announcement_audience x
          where x.announcement_id = a.id
            and (x.area_id is null or x.area_id = p.area_id)
            and (x.position_id is null or x.position_id = p.position_id)
            and (x.level_id is null or x.level_id = p.level_id)
        )
      )
  loop
    perform private.notify(v_who, 'comunicado', a.title,
      left(regexp_replace(regexp_replace(a.body, '[#*_>`\[\]()]', '', 'g'), '\s+', ' ', 'g'), 180),
      '/comunicados/' || a.id, 'comunicado:' || a.id, a.id);
    v_count := v_count + 1;
  end loop;
  update public.announcements set status = 'publicado', published_at = now(), recipients = v_count where id = a.id;
  return v_count;
end;
$$;

revoke all on function public.sync_my_notifications(), public.mark_notifications_read(uuid[]), public.publish_announcement(uuid) from public;
grant execute on function public.sync_my_notifications(), public.mark_notifications_read(uuid[]), public.publish_announcement(uuid) to authenticated;
