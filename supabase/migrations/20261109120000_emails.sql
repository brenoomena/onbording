-- E-mails: fila de envio (email_outbox), preferências de cada pessoa e os
-- lembretes do dia (prazo chegando, atraso e resumo semanal ao gestor).
--
-- Quem grava na fila é o banco (gatilhos e run_email_jobs); quem envia é o
-- servidor do sistema (rota /api/cron/emails, com a chave do Resend), que
-- reserva cada lote com claim_email_batch. dedupe_key impede repetir o mesmo
-- e-mail.

-- ------------------------------------------------------------- configuração
-- { "kinds": { "matricula": true, "prazo": true, "atraso": true,
--              "comunicado": true, "resumo": true },
--   "reminder_days": [3, 0] }
alter table public.app_settings
  add column if not exists email_settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(email_settings) = 'object' and pg_column_size(email_settings) < 2000);

-- ------------------------------------------------------------- preferências
-- Matrícula nova e atraso de trilha obrigatória não podem ser desligados.
create table if not exists public.email_preferences (
  profile_id  uuid primary key references public.profiles (id) on delete cascade,
  lembretes   boolean not null default true,
  comunicados boolean not null default true,
  resumo      boolean not null default true,
  updated_at  timestamptz not null default now()
);
alter table public.email_preferences enable row level security;
revoke all on public.email_preferences from anon, authenticated;
grant select, insert, update on public.email_preferences to authenticated;

drop policy if exists email_preferences_select on public.email_preferences;
create policy email_preferences_select on public.email_preferences for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());
drop policy if exists email_preferences_insert on public.email_preferences;
create policy email_preferences_insert on public.email_preferences for insert to authenticated
  with check (profile_id = auth.uid() and public.is_active_user());
drop policy if exists email_preferences_update on public.email_preferences;
create policy email_preferences_update on public.email_preferences for update to authenticated
  using (profile_id = auth.uid() and public.is_active_user())
  with check (profile_id = auth.uid());

-- ------------------------------------------------------------------- fila
create table if not exists public.email_outbox (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references public.profiles (id) on delete cascade,
  to_email    text not null check (to_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  kind        text not null check (kind in ('matricula', 'prazo_proximo', 'prazo_vencido', 'comunicado', 'resumo_semanal', 'teste')),
  subject     text not null check (length(subject) between 1 and 200),
  data        jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  dedupe_key  text not null unique,
  status      text not null default 'pendente' check (status in ('pendente', 'enviando', 'enviado', 'erro', 'ignorado')),
  attempts    integer not null default 0,
  last_error  text,
  provider_id text,
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz,
  sent_at     timestamptz
);
create index if not exists email_outbox_queue_idx on public.email_outbox (created_at) where status in ('pendente', 'erro', 'enviando');
create index if not exists email_outbox_recent_idx on public.email_outbox (created_at desc);

alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;
grant select on public.email_outbox to authenticated;
drop policy if exists email_outbox_select on public.email_outbox;
create policy email_outbox_select on public.email_outbox for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- funções
create or replace function private.email_on(p_kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (s.email_settings -> 'kinds' ->> p_kind)::boolean from public.app_settings s where s.id = 1), true);
$$;

create or replace function private.email_reminder_days()
returns integer[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when s.email_settings ? 'reminder_days' and jsonb_typeof(s.email_settings -> 'reminder_days') = 'array'
      then array(select x::int from jsonb_array_elements_text(s.email_settings -> 'reminder_days') x where x ~ '^[0-9]{1,2}$')
    else array[3, 0]
  end
  from public.app_settings s where s.id = 1;
$$;

-- Põe um e-mail na fila (só para pessoa ativa; repetidos são ignorados).
create or replace function private.enqueue_email(p_profile uuid, p_kind text, p_subject text, p_data jsonb, p_dedupe text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.email_outbox (profile_id, to_email, kind, subject, data, dedupe_key)
  select p.id, p.email, p_kind, left(p_subject, 200),
    coalesce(p_data, '{}'::jsonb) || jsonb_build_object('name', split_part(p.full_name, ' ', 1)),
    p_dedupe
  from public.profiles p
  where p.id = p_profile and p.status <> 'inativo'
  on conflict (dedupe_key) do nothing;
$$;

-- Avisos do sistema que também viram e-mail: matrícula nova e comunicado importante.
create or replace function private.email_from_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_imp text;
begin
  if new.dedupe_key is null then
    return new;
  end if;
  if new.kind = 'matricula' and private.email_on('matricula') then
    perform private.enqueue_email(new.profile_id, 'matricula', new.title,
      jsonb_build_object('title', new.title, 'body', new.body, 'link', new.link), 'email:' || new.profile_id || ':' || new.dedupe_key);
  elsif new.kind = 'comunicado' and new.announcement_id is not null and private.email_on('comunicado') then
    select importance into v_imp from public.announcements where id = new.announcement_id;
    if v_imp = 'importante'
       and coalesce((select comunicados from public.email_preferences where profile_id = new.profile_id), true) then
      perform private.enqueue_email(new.profile_id, 'comunicado', new.title,
        jsonb_build_object('title', new.title, 'body', new.body, 'link', new.link), 'email:' || new.profile_id || ':' || new.dedupe_key);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists notifications_email on public.notifications;
create trigger notifications_email after insert on public.notifications
  for each row execute function private.email_from_notification();

-- Lembretes do dia. Chamada pela rota agendada (uma vez por dia); pode rodar
-- de novo no mesmo dia sem repetir nada.
create or replace function public.run_email_jobs(p_today date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := coalesce(p_today, (now() at time zone 'America/Sao_Paulo')::date);
  v_days integer[] := private.email_reminder_days();
  r record;
  v_team jsonb;
  v_prazo integer := 0;
  v_atraso integer := 0;
  v_resumo integer := 0;
begin
  -- Prazo chegando (ex.: 3 dias antes e no dia).
  if private.email_on('prazo') then
    for r in
      select e.id, e.profile_id, e.due_date, e.track_id, t.name, round(e.progress_percent) as pct, (e.due_date - v_today) as d
      from public.enrollments e
      join public.tracks t on t.id = e.track_id and t.status = 'publicado'
      join public.profiles p on p.id = e.profile_id and p.status <> 'inativo'
      where e.status <> 'concluida' and e.due_date is not null
        and (e.due_date - v_today) = any (v_days)
        and coalesce((select lembretes from public.email_preferences ep where ep.profile_id = e.profile_id), true)
    loop
      perform private.enqueue_email(r.profile_id, 'prazo_proximo',
        case when r.d = 0 then 'Vence hoje: ' || r.name else 'Prazo chegando: ' || r.name end,
        jsonb_build_object('track', r.name, 'due', to_char(r.due_date, 'DD/MM/YYYY'), 'days', r.d, 'progress', r.pct,
          'link', '/minhas-trilhas/' || r.track_id),
        'email:prazo:' || r.id || ':' || r.due_date || ':' || r.d);
      perform private.notify(r.profile_id, 'prazo_proximo', 'Prazo chegando: ' || r.name,
        case when r.d = 0 then 'Vence hoje.' else 'Vence em ' || to_char(r.due_date, 'DD/MM/YYYY') || '.' end,
        '/minhas-trilhas/' || r.track_id, 'prazo:' || r.id || ':' || r.due_date);
      v_prazo := v_prazo + 1;
    end loop;
  end if;

  -- Atraso: um e-mail por prazo vencido (últimos 7 dias, para não disparar
  -- e-mails de atrasos antigos). Trilha obrigatória: sempre.
  if private.email_on('atraso') then
    for r in
      select e.id, e.profile_id, e.due_date, e.track_id, t.name, t.is_mandatory, round(e.progress_percent) as pct
      from public.enrollments e
      join public.tracks t on t.id = e.track_id and t.status = 'publicado'
      join public.profiles p on p.id = e.profile_id and p.status <> 'inativo'
      where e.status <> 'concluida' and e.due_date is not null
        and e.due_date < v_today and e.due_date >= v_today - 7
        and (t.is_mandatory or coalesce((select lembretes from public.email_preferences ep where ep.profile_id = e.profile_id), true))
    loop
      perform private.enqueue_email(r.profile_id, 'prazo_vencido', 'Prazo vencido: ' || r.name,
        jsonb_build_object('track', r.name, 'due', to_char(r.due_date, 'DD/MM/YYYY'), 'progress', r.pct,
          'mandatory', r.is_mandatory, 'link', '/minhas-trilhas/' || r.track_id),
        'email:vencido:' || r.id || ':' || r.due_date);
      perform private.notify(r.profile_id, 'prazo_vencido', 'Prazo vencido: ' || r.name,
        'O prazo era ' || to_char(r.due_date, 'DD/MM/YYYY') || '. Conclua assim que puder.', '/minhas-trilhas/' || r.track_id,
        'vencido:' || r.id || ':' || r.due_date);
      v_atraso := v_atraso + 1;
    end loop;
  end if;

  -- Resumo semanal ao gestor: segunda-feira, para quem tem equipe.
  if extract(isodow from v_today) = 1 and private.email_on('resumo') then
    for r in
      select s.id
      from public.profiles s
      where s.status <> 'inativo'
        and exists (select 1 from public.profiles c where c.supervisor_id = s.id and c.status <> 'inativo')
        and coalesce((select resumo from public.email_preferences ep where ep.profile_id = s.id), true)
    loop
      select jsonb_agg(x order by x ->> 'late' desc, x ->> 'person', x ->> 'track') into v_team
      from (
        select jsonb_build_object(
          'person', c.full_name,
          'track', t.name,
          'progress', round(e.progress_percent),
          'due', to_char(e.due_date, 'DD/MM/YYYY'),
          'late', (e.status <> 'concluida' and e.due_date is not null and e.due_date < v_today),
          'done', (e.status = 'concluida'),
          'status', e.status::text
        ) as x
        from public.profiles c
        join public.enrollments e on e.profile_id = c.id
        join public.tracks t on t.id = e.track_id and t.status = 'publicado'
        where c.supervisor_id = r.id and c.status <> 'inativo'
          and (e.status <> 'concluida' or e.completed_at >= (v_today - 7))
      ) q;
      if v_team is not null then
        perform private.enqueue_email(r.id, 'resumo_semanal', 'Resumo semanal da sua equipe',
          jsonb_build_object(
            'rows', v_team,
            'late', (select count(*) from jsonb_array_elements(v_team) y where (y ->> 'late')::boolean),
            'done', (select count(*) from jsonb_array_elements(v_team) y where (y ->> 'done')::boolean),
            'open', (select count(*) from jsonb_array_elements(v_team) y where not (y ->> 'done')::boolean),
            'week', to_char(v_today, 'DD/MM/YYYY'),
            'link', '/acompanhamento'),
          'email:resumo:' || r.id || ':' || v_today);
        v_resumo := v_resumo + 1;
      end if;
    end loop;
  end if;

  return jsonb_build_object('prazo', v_prazo, 'atraso', v_atraso, 'resumo', v_resumo);
end;
$$;

-- Reserva um lote para envio (dois envios ao mesmo tempo não pegam o mesmo).
create or replace function public.claim_email_batch(p_limit integer default 50)
returns setof public.email_outbox
language sql
security definer
set search_path = ''
as $$
  update public.email_outbox o
  set status = 'enviando', attempts = o.attempts + 1, claimed_at = now()
  where o.id in (
    select q.id from public.email_outbox q
    where q.status = 'pendente'
       or (q.status = 'erro' and q.attempts < 5)
       or (q.status = 'enviando' and q.claimed_at < now() - interval '10 minutes')
    order by q.created_at
    limit least(greatest(p_limit, 1), 200)
    for update skip locked
  )
  returning o.*;
$$;

-- E-mail de teste para quem está logado (Administrador).
create or replace function public.queue_test_email()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_key text := 'email:teste:' || auth.uid() || ':' || extract(epoch from clock_timestamp())::bigint;
begin
  if not public.is_admin() then
    raise exception 'Somente administradores podem enviar o e-mail de teste.' using errcode = '42501';
  end if;
  perform private.enqueue_email(auth.uid(), 'teste', 'E-mail de teste do Onboarding', jsonb_build_object('link', '/configuracoes?secao=emails'), v_key);
  select id into v_id from public.email_outbox where dedupe_key = v_key;
  return v_id;
end;
$$;

revoke all on function public.run_email_jobs(date), public.claim_email_batch(integer), public.queue_test_email() from public, anon, authenticated;
grant execute on function public.run_email_jobs(date), public.claim_email_batch(integer) to service_role;
grant execute on function public.queue_test_email() to authenticated;
revoke all on function private.email_on(text), private.email_reminder_days(), private.enqueue_email(uuid, text, text, jsonb, text), private.email_from_notification() from public, anon, authenticated;
