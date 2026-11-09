-- =====================================================================
-- Checklist de integração
--
-- Modelos (checklist_templates) com tarefas, cada uma com um responsável
-- (RH, supervisor, o próprio colaborador ou uma pessoa) e um prazo relativo
-- à admissão. Ao cadastrar alguém em onboarding que atende ao público do
-- modelo, o checklist é criado sozinho (ou aplicado à mão pelo RH).
--
-- Responsável "rh": quem tem checklists.gerenciar. "supervisor": o supervisor
-- atual da pessoa (sem supervisor, o RH). Avisos: tarefa atribuída, tarefa
-- vencendo/atrasada (sininho e e-mail diário), checklist concluído. Tarefas
-- do próprio colaborador dão pontos; concluir o checklist dá medalha.
-- =====================================================================

insert into public.permissions (key, module, name, description, sort_order) values
  ('checklists.gerenciar', 'Integração', 'Gerenciar checklists', 'Cria modelos de checklist de integração, aplica nas pessoas e cuida das tarefas do RH.', 75)
on conflict (key) do update set module = excluded.module, name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;

-- ------------------------------------------------------------------ modelos
create table if not exists public.checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 3 and 120),
  description text check (description is null or length(description) <= 1000),
  status      text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'arquivado')),
  auto_apply  boolean not null default true,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.checklist_template_audience (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates (id) on delete cascade,
  area_id     uuid references public.areas (id) on delete cascade,
  position_id uuid references public.positions (id) on delete cascade,
  level_id    uuid references public.levels (id) on delete cascade
);
create index if not exists checklist_template_audience_idx on public.checklist_template_audience (template_id);

create table if not exists public.checklist_template_items (
  id               uuid primary key default gen_random_uuid(),
  template_id      uuid not null references public.checklist_templates (id) on delete cascade,
  position         integer not null default 0,
  title            text not null check (length(btrim(title)) between 2 and 160),
  description      text check (description is null or length(description) <= 1000),
  responsible_kind text not null default 'rh' check (responsible_kind in ('rh', 'supervisor', 'colaborador', 'pessoa')),
  responsible_id   uuid references public.profiles (id) on delete restrict,
  offset_days      integer not null default 0 check (offset_days between -90 and 365),
  constraint checklist_item_person check (responsible_kind <> 'pessoa' or responsible_id is not null)
);
create index if not exists checklist_template_items_idx on public.checklist_template_items (template_id, position);

-- ---------------------------------------------------- checklist de cada pessoa
create table if not exists public.onboarding_checklists (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  template_id  uuid references public.checklist_templates (id) on delete set null,
  name         text not null,
  origin       text not null default 'manual' check (origin in ('automatica', 'manual')),
  applied_by   uuid,
  applied_at   timestamptz not null default now(),
  completed_at timestamptz,
  constraint onboarding_checklists_unique unique (profile_id, template_id)
);
create index if not exists onboarding_checklists_profile_idx on public.onboarding_checklists (profile_id);

create table if not exists public.onboarding_tasks (
  id               uuid primary key default gen_random_uuid(),
  checklist_id     uuid not null references public.onboarding_checklists (id) on delete cascade,
  profile_id       uuid not null references public.profiles (id) on delete cascade,
  position         integer not null default 0,
  title            text not null check (length(btrim(title)) between 2 and 160),
  description      text check (description is null or length(description) <= 1000),
  responsible_kind text not null check (responsible_kind in ('rh', 'supervisor', 'colaborador', 'pessoa')),
  responsible_id   uuid references public.profiles (id) on delete set null,
  due_date         date,
  done_at          timestamptz,
  done_by          uuid references public.profiles (id) on delete set null,
  note             text check (note is null or length(note) <= 500),
  created_at       timestamptz not null default now()
);
create index if not exists onboarding_tasks_checklist_idx on public.onboarding_tasks (checklist_id, position);
create index if not exists onboarding_tasks_profile_idx on public.onboarding_tasks (profile_id);
create index if not exists onboarding_tasks_responsible_idx on public.onboarding_tasks (responsible_id);
create index if not exists onboarding_tasks_open_idx on public.onboarding_tasks (due_date) where done_at is null;

-- -------------------------------------------------------------- gamificação
alter table public.points_ledger drop constraint if exists points_ledger_reason_check;
alter table public.points_ledger add constraint points_ledger_reason_check check (
  reason in ('etapa_obrigatoria', 'etapa_opcional', 'avaliacao', 'avaliacao_primeira', 'trilha', 'trilha_no_prazo', 'tarefa', 'checklist')
);
insert into public.badges (key, name, description, icon, tone, sort_order) values
  ('integrado', 'Integração concluída', 'Teve todas as tarefas do checklist de integração concluídas.', 'handshake', 'ok', 90)
on conflict (key) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, tone = excluded.tone, sort_order = excluded.sort_order;

-- ------------------------------------------------------------------ avisos
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in ('matricula', 'prazo_proximo', 'prazo_vencido', 'correcao_pendente', 'avaliacao_corrigida', 'certificado', 'comunicado', 'medalha',
           'equipe_atraso', 'tarefa', 'tarefa_prazo', 'checklist_concluido')
);
alter table public.email_outbox drop constraint if exists email_outbox_kind_check;
alter table public.email_outbox add constraint email_outbox_kind_check check (
  kind in ('matricula', 'prazo_proximo', 'prazo_vencido', 'comunicado', 'resumo_semanal', 'equipe_atraso', 'tarefas_dia', 'teste')
);
alter table public.email_preferences add column if not exists tarefas boolean not null default true;

-- ------------------------------------------------------------------ regras
-- Quem responde pela tarefa agora (o RH vira várias pessoas).
create or replace function private.task_recipients(p_task uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with t as (
    select t.*, p.supervisor_id as sup
    from public.onboarding_tasks t join public.profiles p on p.id = t.profile_id
    where t.id = p_task
  ), direct as (
    select case
      when t.responsible_kind in ('colaborador', 'pessoa') then t.responsible_id
      when t.responsible_kind = 'supervisor' then t.sup
    end as id
    from t
  )
  select d.id from direct d
  join public.profiles x on x.id = d.id and x.status <> 'inativo'
  where d.id is not null
  union
  select x.id from public.profiles x, t, direct d
  where d.id is null and x.status <> 'inativo' and private.profile_has_permission(x.id, 'checklists.gerenciar');
$$;

create or replace function public.can_handle_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and (
    public.has_permission('checklists.gerenciar')
    or exists (select 1 from private.task_recipients(p_task) r where r = auth.uid())
  );
$$;

create or replace function public.can_view_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.onboarding_tasks t
    where t.id = p_task
      and (public.can_view_progress_of(t.profile_id) or public.has_permission('checklists.gerenciar') or public.can_handle_task(t.id))
  );
$$;

create or replace function private.checklist_template_matches(p_template uuid, p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.checklist_template_audience a where a.template_id = p_template)
      or exists (
        select 1
        from public.checklist_template_audience a
        join public.profiles p on p.id = p_profile
        where a.template_id = p_template
          and (a.area_id is null or a.area_id = p.area_id)
          and (a.position_id is null or a.position_id = p.position_id)
          and (a.level_id is null or a.level_id = p.level_id)
      );
$$;

-- Avisa cada responsável quantas tarefas recebeu num checklist (uma vez).
create or replace function private.notify_checklist_assigned(p_checklist uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.onboarding_checklists;
  v_person text;
  r record;
begin
  select * into c from public.onboarding_checklists where id = p_checklist;
  select full_name into v_person from public.profiles where id = c.profile_id;
  for r in
    select rc as who, count(*) as n
    from public.onboarding_tasks t, lateral private.task_recipients(t.id) rc
    where t.checklist_id = c.id and t.done_at is null
    group by rc
  loop
    if r.who = c.profile_id then
      perform private.notify(r.who, 'tarefa', 'Seu checklist de integração',
        r.n || case when r.n = 1 then ' tarefa' else ' tarefas' end || ' para você em "' || c.name || '".',
        '/tarefas', 'tarefa:checklist:' || c.id || ':' || r.who);
    else
      perform private.notify(r.who, 'tarefa', 'Checklist de ' || v_person,
        r.n || case when r.n = 1 then ' tarefa' else ' tarefas' end || ' para você em "' || c.name || '".',
        '/tarefas', 'tarefa:checklist:' || c.id || ':' || r.who);
    end if;
  end loop;
end;
$$;

-- Cria o checklist de uma pessoa a partir do modelo.
create or replace function private.apply_checklist(p_template uuid, p_profile uuid, p_origin text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  tpl public.checklist_templates;
  p public.profiles;
  v_base date;
  v_id uuid;
begin
  select * into tpl from public.checklist_templates where id = p_template;
  select * into p from public.profiles where id = p_profile;
  if tpl.id is null or p.id is null then
    return null;
  end if;
  v_base := coalesce(p.admission_date, p.onboarding_start_date, (now() at time zone 'America/Sao_Paulo')::date);
  insert into public.onboarding_checklists (profile_id, template_id, name, origin, applied_by)
  values (p.id, tpl.id, tpl.name, p_origin, auth.uid())
  on conflict (profile_id, template_id) do nothing
  returning id into v_id;
  if v_id is null then
    return null;
  end if;
  perform set_config('app.bulk_tasks', '1', true);
  insert into public.onboarding_tasks (checklist_id, profile_id, position, title, description, responsible_kind, responsible_id, due_date)
  select v_id, p.id, i.position, i.title, i.description, i.responsible_kind,
         case i.responsible_kind when 'colaborador' then p.id when 'pessoa' then i.responsible_id end,
         v_base + i.offset_days
  from public.checklist_template_items i
  where i.template_id = tpl.id
  order by i.position;
  perform set_config('app.bulk_tasks', '', true);
  perform private.refresh_checklist(v_id);
  perform private.notify_checklist_assigned(v_id);
  return v_id;
end;
$$;

-- Cria os checklists automáticos que faltam (só para quem está em onboarding).
create or replace function private.sync_checklists(p_template uuid, p_profile uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_n integer := 0;
begin
  for r in
    select t.id as tpl, p.id as person
    from public.checklist_templates t
    cross join public.profiles p
    where t.status = 'publicado' and t.auto_apply
      and p.status = 'onboarding'
      and (p_template is null or t.id = p_template)
      and (p_profile is null or p.id = p_profile)
      and not exists (select 1 from public.onboarding_checklists c where c.profile_id = p.id and c.template_id = t.id)
      and exists (select 1 from public.checklist_template_items i where i.template_id = t.id)
      and private.checklist_template_matches(t.id, p.id)
  loop
    if private.apply_checklist(r.tpl, r.person, 'automatica') is not null then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;

-- Concluído quando todas as tarefas terminam; pontos e medalha.
create or replace function private.refresh_checklist(p_checklist uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.onboarding_checklists;
  v_total integer;
  v_open integer;
  v_person text;
  v_who uuid;
begin
  select * into c from public.onboarding_checklists where id = p_checklist;
  if c.id is null then
    return;
  end if;
  select count(*), count(*) filter (where done_at is null) into v_total, v_open from public.onboarding_tasks where checklist_id = c.id;
  if v_total > 0 and v_open = 0 and c.completed_at is null then
    update public.onboarding_checklists set completed_at = now() where id = c.id;
    select full_name into v_person from public.profiles where id = c.profile_id;
    perform private.add_points(c.profile_id, 20, 'checklist', 'Checklist concluído: ' || c.name, 'checklist:' || c.id);
    perform private.award_badge(c.profile_id, 'integrado');
    for v_who in
      select x.id from public.profiles x
      where x.status <> 'inativo' and x.id <> c.profile_id
        and (private.profile_has_permission(x.id, 'checklists.gerenciar')
             or x.id = (select supervisor_id from public.profiles where id = c.profile_id))
    loop
      perform private.notify(v_who, 'checklist_concluido', 'Checklist concluído: ' || v_person,
        'Todas as tarefas de "' || c.name || '" foram feitas.', '/colaboradores/' || c.profile_id, 'checklist:' || c.id);
    end loop;
  elsif (v_open > 0 or v_total = 0) and c.completed_at is not null then
    update public.onboarding_checklists set completed_at = null where id = c.id;
  end if;
end;
$$;

create or replace function private.after_task_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_who uuid;
  v_person text;
begin
  if tg_op = 'DELETE' then
    perform private.refresh_checklist(old.checklist_id);
    return null;
  end if;
  -- Ponto para a tarefa do próprio colaborador.
  if new.done_at is not null and (tg_op = 'INSERT' or old.done_at is null)
     and new.responsible_kind = 'colaborador' and new.responsible_id = new.profile_id then
    perform private.add_points(new.profile_id, 5, 'tarefa', 'Tarefa: ' || new.title, 'tarefa:' || new.id);
  end if;
  if tg_op = 'INSERT' or old.done_at is distinct from new.done_at then
    perform private.refresh_checklist(new.checklist_id);
  end if;
  -- Tarefa nova ou com outro responsável, fora da criação em lote: avisa.
  if coalesce(current_setting('app.bulk_tasks', true), '') <> '1' and new.done_at is null
     and (tg_op = 'INSERT' or old.responsible_kind is distinct from new.responsible_kind or old.responsible_id is distinct from new.responsible_id) then
    select full_name into v_person from public.profiles where id = new.profile_id;
    for v_who in select * from private.task_recipients(new.id) loop
      perform private.notify(v_who, 'tarefa',
        case when v_who = new.profile_id then 'Nova tarefa para você' else 'Nova tarefa: ' || v_person end,
        new.title || case when new.due_date is not null then ' · até ' || to_char(new.due_date, 'DD/MM/YYYY') else '' end || '.',
        '/tarefas', 'tarefa:' || new.id || ':' || v_who || ':' || coalesce(new.responsible_kind, '') || coalesce(new.responsible_id::text, ''));
    end loop;
  end if;
  return null;
end;
$$;
drop trigger if exists onboarding_tasks_after on public.onboarding_tasks;
create trigger onboarding_tasks_after after insert or update or delete on public.onboarding_tasks
  for each row execute function private.after_task_change();

create or replace function private.after_checklist_profile_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_checklists(null, new.id);
  return null;
end;
$$;
drop trigger if exists profiles_sync_checklists on public.profiles;
create trigger profiles_sync_checklists after insert or update of area_id, position_id, level_id, status on public.profiles
  for each row execute function private.after_checklist_profile_change();

create or replace function private.after_checklist_template_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tpl uuid;
begin
  v_tpl := new.id;
  perform private.sync_checklists(v_tpl, null);
  return null;
end;
$$;
drop trigger if exists checklist_templates_sync on public.checklist_templates;
create trigger checklist_templates_sync after insert or update of status, auto_apply on public.checklist_templates
  for each row execute function private.after_checklist_template_change();
-- O público e as tarefas mudam juntos em save_checklist_template (sem gatilho
-- no público: apagar e recriar as regras não pode aplicar o modelo a todos).

create or replace function private.touch_checklist_template()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists checklist_templates_touch on public.checklist_templates;
create trigger checklist_templates_touch before update on public.checklist_templates
  for each row execute function private.touch_checklist_template();

-- --------------------------------------------------------------- funções RPC
-- Aplica um modelo à mão (RH).
create or replace function public.apply_checklist(p_template uuid, p_profile uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.has_permission('checklists.gerenciar') then
    raise exception 'Você não pode aplicar checklists.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.checklist_template_items where template_id = p_template) then
    raise exception 'Este modelo ainda não tem tarefas.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.onboarding_checklists where profile_id = p_profile and template_id = p_template) then
    raise exception 'Esta pessoa já tem este checklist.' using errcode = 'P0001';
  end if;
  v_id := private.apply_checklist(p_template, p_profile, 'manual');
  if v_id is null then
    raise exception 'Modelo ou pessoa não encontrados.' using errcode = 'P0002';
  end if;
  return v_id;
end;
$$;

-- Marca ou desmarca uma tarefa (só o responsável ou o RH).
create or replace function public.set_task_done(p_task uuid, p_done boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_handle_task(p_task) then
    raise exception 'Só o responsável pela tarefa (ou o RH) pode marcá-la.' using errcode = '42501';
  end if;
  update public.onboarding_tasks
  set done_at = case when p_done then coalesce(done_at, now()) else null end,
      done_by = case when p_done then coalesce(done_by, auth.uid()) else null end,
      note = case when p_note is null then note else nullif(left(btrim(p_note), 500), '') end
  where id = p_task;
end;
$$;

-- Salva o modelo inteiro de uma vez (dados, público e tarefas) e aplica a
-- quem passou a atender, se estiver publicado. Devolve o id.
create or replace function public.save_checklist_template(
  p_id uuid, p_name text, p_description text, p_auto_apply boolean, p_audience jsonb, p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  if not public.has_permission('checklists.gerenciar') then
    raise exception 'Você não pode editar checklists.' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 100
     or jsonb_typeof(coalesce(p_audience, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_audience, '[]'::jsonb)) > 50 then
    raise exception 'Dados do modelo inválidos.' using errcode = '22023';
  end if;
  if v_id is null then
    insert into public.checklist_templates (name, description, auto_apply)
    values (btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_auto_apply, true))
    returning id into v_id;
  else
    update public.checklist_templates
    set name = btrim(p_name), description = nullif(btrim(coalesce(p_description, '')), ''), auto_apply = coalesce(p_auto_apply, true)
    where id = v_id;
    if not found then
      raise exception 'Modelo não encontrado.' using errcode = 'P0002';
    end if;
  end if;

  delete from public.checklist_template_audience where template_id = v_id;
  insert into public.checklist_template_audience (template_id, area_id, position_id, level_id)
  select v_id, nullif(a ->> 'area_id', '')::uuid, nullif(a ->> 'position_id', '')::uuid, nullif(a ->> 'level_id', '')::uuid
  from jsonb_array_elements(coalesce(p_audience, '[]'::jsonb)) a;

  delete from public.checklist_template_items where template_id = v_id;
  insert into public.checklist_template_items (template_id, position, title, description, responsible_kind, responsible_id, offset_days)
  select v_id, (x.ord - 1)::int, btrim(x.v ->> 'title'), nullif(btrim(coalesce(x.v ->> 'description', '')), ''),
         x.v ->> 'responsibleKind',
         case when x.v ->> 'responsibleKind' = 'pessoa' then nullif(x.v ->> 'responsibleId', '')::uuid end,
         coalesce((x.v ->> 'offsetDays')::int, 0)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as x(v, ord);

  perform private.sync_checklists(v_id, null);
  return v_id;
end;
$$;

-- Lembretes do dia para as tarefas (chamado por run_email_jobs).
create or replace function private.task_jobs(p_today date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_n integer := 0;
  v_rows jsonb;
begin
  -- Sininho: no dia e no primeiro dia de atraso (atrasos de até 7 dias).
  for r in
    select t.id, t.title, t.due_date, p.full_name as person, p.id as person_id, rc as who
    from public.onboarding_tasks t
    join public.profiles p on p.id = t.profile_id and p.status <> 'inativo'
    cross join lateral private.task_recipients(t.id) rc
    where t.done_at is null and t.due_date is not null
      and t.due_date <= p_today and t.due_date >= p_today - 7
  loop
    perform private.notify(r.who, 'tarefa_prazo',
      case when r.due_date = p_today then 'Tarefa vence hoje' else 'Tarefa atrasada' end,
      r.title || case when r.who = r.person_id then '' else ' · ' || r.person end
        || case when r.due_date < p_today then ' (venceu em ' || to_char(r.due_date, 'DD/MM/YYYY') || ')' else '' end || '.',
      '/tarefas', 'tarefa_prazo:' || r.id || ':' || r.due_date || ':' || case when r.due_date = p_today then 'hoje' else 'atraso' end);
    v_n := v_n + 1;
  end loop;

  -- E-mail: um resumo por pessoa quando alguma tarefa vence hoje ou venceu ontem.
  if private.email_on('tarefas') then
    for r in
      select rc as who
      from public.onboarding_tasks t
      join public.profiles p on p.id = t.profile_id and p.status <> 'inativo'
      cross join lateral private.task_recipients(t.id) rc
      where t.done_at is null and t.due_date in (p_today, p_today - 1)
      group by rc
    loop
      if not coalesce((select tarefas from public.email_preferences ep where ep.profile_id = r.who), true) then
        continue;
      end if;
      select jsonb_agg(jsonb_build_object(
               'title', q.title, 'person', q.person, 'own', q.person_id = r.who,
               'due', to_char(q.due_date, 'DD/MM/YYYY'), 'late', q.due_date < p_today
             ) order by q.due_date, q.person, q.title)
        into v_rows
      from (
        select t.title, t.due_date, p.full_name as person, p.id as person_id
        from public.onboarding_tasks t
        join public.profiles p on p.id = t.profile_id and p.status <> 'inativo'
        where t.done_at is null and t.due_date is not null and t.due_date <= p_today and t.due_date >= p_today - 30
          and exists (select 1 from private.task_recipients(t.id) x where x = r.who)
        order by t.due_date
        limit 40
      ) q;
      perform private.enqueue_email(r.who, 'tarefas_dia', 'Tarefas de integração para hoje',
        jsonb_build_object('rows', coalesce(v_rows, '[]'::jsonb), 'link', '/tarefas'),
        'email:tarefas:' || r.who || ':' || p_today);
    end loop;
  end if;
  return v_n;
end;
$$;

-- run_email_jobs passa a incluir as tarefas.
do $$
declare
  v_src text;
begin
  select pg_get_functiondef('public.run_email_jobs(date)'::regprocedure) into v_src;
  if position('private.task_jobs' in v_src) = 0 then
    v_src := replace(v_src,
      'return jsonb_build_object(''prazo'', v_prazo, ''atraso'', v_atraso, ''equipe'', v_equipe, ''resumo'', v_resumo);',
      'return jsonb_build_object(''prazo'', v_prazo, ''atraso'', v_atraso, ''equipe'', v_equipe, ''resumo'', v_resumo, ''tarefas'', private.task_jobs(v_today));');
    if position('private.task_jobs' in v_src) = 0 then
      raise exception 'run_email_jobs não tem o formato esperado.';
    end if;
    execute v_src;
  end if;
end;
$$;

-- -------------------------------------------------------------------- RLS
alter table public.checklist_templates enable row level security;
alter table public.checklist_template_audience enable row level security;
alter table public.checklist_template_items enable row level security;
alter table public.onboarding_checklists enable row level security;
alter table public.onboarding_tasks enable row level security;
revoke all on public.checklist_templates, public.checklist_template_audience, public.checklist_template_items,
  public.onboarding_checklists, public.onboarding_tasks from anon, authenticated;
grant select, insert, update, delete on public.checklist_templates, public.checklist_template_audience, public.checklist_template_items,
  public.onboarding_checklists, public.onboarding_tasks to authenticated;

drop policy if exists checklist_templates_all on public.checklist_templates;
create policy checklist_templates_all on public.checklist_templates for all to authenticated
  using (public.has_permission('checklists.gerenciar')) with check (public.has_permission('checklists.gerenciar'));
drop policy if exists checklist_template_audience_all on public.checklist_template_audience;
create policy checklist_template_audience_all on public.checklist_template_audience for all to authenticated
  using (public.has_permission('checklists.gerenciar')) with check (public.has_permission('checklists.gerenciar'));
drop policy if exists checklist_template_items_all on public.checklist_template_items;
create policy checklist_template_items_all on public.checklist_template_items for all to authenticated
  using (public.has_permission('checklists.gerenciar')) with check (public.has_permission('checklists.gerenciar'));

drop policy if exists onboarding_checklists_select on public.onboarding_checklists;
create policy onboarding_checklists_select on public.onboarding_checklists for select to authenticated using (
  public.is_active_user() and (
    public.can_view_progress_of(profile_id) or public.has_permission('checklists.gerenciar')
    or exists (select 1 from public.onboarding_tasks t where t.checklist_id = onboarding_checklists.id and public.can_handle_task(t.id))
  )
);
drop policy if exists onboarding_checklists_write on public.onboarding_checklists;
create policy onboarding_checklists_write on public.onboarding_checklists for update to authenticated
  using (public.has_permission('checklists.gerenciar')) with check (public.has_permission('checklists.gerenciar'));
drop policy if exists onboarding_checklists_delete on public.onboarding_checklists;
create policy onboarding_checklists_delete on public.onboarding_checklists for delete to authenticated
  using (public.has_permission('checklists.gerenciar'));

drop policy if exists onboarding_tasks_select on public.onboarding_tasks;
create policy onboarding_tasks_select on public.onboarding_tasks for select to authenticated using (
  public.is_active_user() and (public.can_view_progress_of(profile_id) or public.has_permission('checklists.gerenciar') or public.can_handle_task(id))
);
drop policy if exists onboarding_tasks_insert on public.onboarding_tasks;
create policy onboarding_tasks_insert on public.onboarding_tasks for insert to authenticated
  with check (public.has_permission('checklists.gerenciar'));
drop policy if exists onboarding_tasks_update on public.onboarding_tasks;
create policy onboarding_tasks_update on public.onboarding_tasks for update to authenticated
  using (public.has_permission('checklists.gerenciar')) with check (public.has_permission('checklists.gerenciar'));
drop policy if exists onboarding_tasks_delete on public.onboarding_tasks;
create policy onboarding_tasks_delete on public.onboarding_tasks for delete to authenticated
  using (public.has_permission('checklists.gerenciar'));

revoke all on function public.apply_checklist(uuid, uuid), public.set_task_done(uuid, boolean, text), public.save_checklist_template(uuid, text, text, boolean, jsonb, jsonb),
  public.can_handle_task(uuid), public.can_view_task(uuid) from public, anon;
grant execute on function public.apply_checklist(uuid, uuid), public.set_task_done(uuid, boolean, text), public.save_checklist_template(uuid, text, text, boolean, jsonb, jsonb),
  public.can_handle_task(uuid), public.can_view_task(uuid) to authenticated;
revoke all on function private.task_recipients(uuid), private.checklist_template_matches(uuid, uuid), private.notify_checklist_assigned(uuid),
  private.apply_checklist(uuid, uuid, text), private.sync_checklists(uuid, uuid), private.refresh_checklist(uuid), private.task_jobs(date)
  from public, anon, authenticated;
