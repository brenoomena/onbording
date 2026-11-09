-- Aviso imediato ao supervisor quando a trilha de alguém da equipe atrasa:
-- no sininho (sempre) e por e-mail (Configurações › E-mails e preferência
-- "Atraso na equipe" em Meu perfil). Gerado na tarefa diária, um por prazo.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in ('matricula', 'prazo_proximo', 'prazo_vencido', 'correcao_pendente', 'avaliacao_corrigida', 'certificado', 'comunicado', 'medalha', 'equipe_atraso')
);

alter table public.email_outbox drop constraint if exists email_outbox_kind_check;
alter table public.email_outbox add constraint email_outbox_kind_check check (
  kind in ('matricula', 'prazo_proximo', 'prazo_vencido', 'comunicado', 'resumo_semanal', 'equipe_atraso', 'teste')
);

alter table public.email_preferences add column if not exists equipe boolean not null default true;

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
  v_equipe integer := 0;
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

  -- Atraso na equipe: aviso ao supervisor (sininho sempre; e-mail conforme
  -- Configurações e a preferência dele), um por prazo vencido.
  for r in
    select e.id, e.due_date, e.track_id, t.name, t.is_mandatory, round(e.progress_percent) as pct,
      c.id as person_id, c.full_name as person, s.id as sup
    from public.enrollments e
    join public.tracks t on t.id = e.track_id and t.status = 'publicado'
    join public.profiles c on c.id = e.profile_id and c.status <> 'inativo'
    join public.profiles s on s.id = c.supervisor_id and s.status <> 'inativo'
    where e.status <> 'concluida' and e.due_date is not null
      and e.due_date < v_today and e.due_date >= v_today - 7
  loop
    perform private.notify(r.sup, 'equipe_atraso', 'Atraso na equipe: ' || r.person,
      '"' || r.name || '" venceu em ' || to_char(r.due_date, 'DD/MM/YYYY') || ' (progresso ' || r.pct || '%).',
      '/colaboradores/' || r.person_id, 'equipe:' || r.id || ':' || r.due_date);
    if private.email_on('equipe')
       and coalesce((select equipe from public.email_preferences ep where ep.profile_id = r.sup), true) then
      perform private.enqueue_email(r.sup, 'equipe_atraso', 'Atraso na equipe: ' || r.person,
        jsonb_build_object('person', r.person, 'track', r.name, 'due', to_char(r.due_date, 'DD/MM/YYYY'), 'progress', r.pct,
          'mandatory', r.is_mandatory, 'link', '/colaboradores/' || r.person_id),
        'email:equipe:' || r.id || ':' || r.due_date);
    end if;
    v_equipe := v_equipe + 1;
  end loop;

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

  return jsonb_build_object('prazo', v_prazo, 'atraso', v_atraso, 'equipe', v_equipe, 'resumo', v_resumo);
end;
$$;

-- Sininho do supervisor na hora em que ele abre o sistema.
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
  -- Supervisor: atrasos da equipe aparecem assim que ele abre o sistema
  -- (a tarefa diária usa a mesma chave, então não repete).
  for r in
    select e.id, e.due_date, t.name, round(e.progress_percent) as pct, c.id as person_id, c.full_name as person
    from public.enrollments e
    join public.tracks t on t.id = e.track_id and t.status = 'publicado'
    join public.profiles c on c.id = e.profile_id and c.status <> 'inativo'
    where c.supervisor_id = auth.uid() and e.status <> 'concluida' and e.due_date is not null
      and e.due_date < v_today and e.due_date >= v_today - 7
  loop
    perform private.notify(auth.uid(), 'equipe_atraso', 'Atraso na equipe: ' || r.person,
      '"' || r.name || '" venceu em ' || to_char(r.due_date, 'DD/MM/YYYY') || ' (progresso ' || r.pct || '%).',
      '/colaboradores/' || r.person_id, 'equipe:' || r.id || ':' || r.due_date);
  end loop;
  return (select count(*) from public.notifications where profile_id = auth.uid()) - v_before;
end;
$$;

revoke all on function public.sync_my_notifications() from public;
grant execute on function public.sync_my_notifications() to authenticated;
revoke all on function public.run_email_jobs(date) from public, anon, authenticated;
grant execute on function public.run_email_jobs(date) to service_role;
