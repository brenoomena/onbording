-- =====================================================================
-- Etapa 1 · Fundação
-- Organização (áreas, cargos, níveis), pessoas e acesso (perfis,
-- permissões, colaboradores) e registro de auditoria.
--
-- Regras gerais:
--   * Nada é apagado de forma silenciosa: chaves estrangeiras usam
--     ON DELETE RESTRICT e o padrão é desativar (coluna active/status).
--   * Toda leitura e escrita feita pela aplicação passa por RLS.
--   * Todas as alterações administrativas ficam em audit_log.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Sessões técnicas (migrações, SQL editor, chave service_role) passam
-- pelas travas de negócio; a aplicação nunca usa esses papéis para
-- operações feitas em nome de um usuário. A verificação usa o JWT da
-- requisição, e não current_user, porque as funções de trava rodam
-- como SECURITY DEFINER.
create or replace function private.is_privileged_session()
returns boolean
language sql
stable
as $$
  select auth.uid() is null
     and coalesce(auth.jwt() ->> 'role', 'service_role') = 'service_role';
$$;

-- ---------------------------------------------------------------------
-- Organização
-- ---------------------------------------------------------------------

create table public.areas (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 2 and 80),
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index areas_name_key on public.areas (lower(btrim(name)));

create table public.levels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 2 and 60),
  rank        integer not null check (rank > 0),
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint levels_rank_key unique (rank) deferrable initially deferred
);
create unique index levels_name_key on public.levels (lower(btrim(name)));
comment on column public.levels.rank is 'Posição na hierarquia: 1 é o nível inicial.';

create table public.positions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 2 and 80),
  area_id     uuid not null references public.areas (id) on delete restrict,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index positions_area_name_key on public.positions (area_id, lower(btrim(name)));
create index positions_area_idx on public.positions (area_id);

create table public.position_levels (
  position_id uuid not null references public.positions (id) on delete cascade,
  level_id    uuid not null references public.levels (id) on delete restrict,
  created_at  timestamptz not null default now(),
  primary key (position_id, level_id)
);
create index position_levels_level_idx on public.position_levels (level_id);

-- ---------------------------------------------------------------------
-- Perfis de acesso e permissões
-- ---------------------------------------------------------------------

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  name        text not null check (length(btrim(name)) between 2 and 60),
  description text,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on column public.roles.is_system is 'Perfis de fábrica (admin, supervisor, colaborador) não podem ser excluídos.';

create table public.permissions (
  key         text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  module      text not null,
  name        text not null,
  description text,
  sort_order  integer not null default 0
);

create table public.role_permissions (
  role_id        uuid not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (role_id, permission_key)
);

-- ---------------------------------------------------------------------
-- Colaboradores
-- ---------------------------------------------------------------------

create type public.user_status as enum ('onboarding', 'ativo', 'inativo');

create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete restrict,
  full_name             text not null check (length(btrim(full_name)) between 3 and 120),
  email                 text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role_id               uuid not null references public.roles (id) on delete restrict,
  area_id               uuid references public.areas (id) on delete restrict,
  position_id           uuid references public.positions (id) on delete restrict,
  level_id              uuid references public.levels (id) on delete restrict,
  supervisor_id         uuid references public.profiles (id) on delete set null,
  admission_date        date,
  onboarding_start_date date,
  status                public.user_status not null default 'onboarding',
  last_access_at        timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint profiles_not_own_supervisor check (supervisor_id is null or supervisor_id <> id),
  constraint profiles_onboarding_after_admission check (
    onboarding_start_date is null or admission_date is null or onboarding_start_date >= admission_date
  )
);
create unique index profiles_email_key on public.profiles (lower(email));
create index profiles_role_idx       on public.profiles (role_id);
create index profiles_area_idx       on public.profiles (area_id);
create index profiles_position_idx   on public.profiles (position_id);
create index profiles_level_idx      on public.profiles (level_id);
create index profiles_supervisor_idx on public.profiles (supervisor_id);
create index profiles_status_idx     on public.profiles (status);

-- ---------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------

create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  action     text not null check (action in ('insert', 'update', 'delete')),
  table_name text not null,
  record_id  text,
  old_data   jsonb,
  new_data   jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_table_idx   on public.audit_log (table_name, created_at desc);
create index audit_log_actor_idx   on public.audit_log (actor_id, created_at desc);

-- ---------------------------------------------------------------------
-- Funções de permissão (usadas pelas políticas RLS e pela aplicação)
-- ---------------------------------------------------------------------

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status <> 'inativo'
  );
$$;

create or replace function public.is_admin()
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
    where p.id = auth.uid() and p.status <> 'inativo' and r.key = 'admin'
  );
$$;

-- O perfil "admin" tem sempre todas as permissões, para que a
-- plataforma nunca fique sem alguém capaz de administrá-la.
create or replace function public.has_permission(p_key text)
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
    where p.id = auth.uid()
      and p.status <> 'inativo'
      and (
        r.key = 'admin'
        or exists (
          select 1 from public.role_permissions rp
          where rp.role_id = r.id and rp.permission_key = p_key
        )
      )
  );
$$;

-- Supervisor direto de quem está logado (para o colaborador ver quem o acompanha).
create or replace function public.my_supervisor_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select supervisor_id from public.profiles where id = auth.uid() and status <> 'inativo';
$$;

create or replace function public.my_permissions()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select perm.key
  from public.profiles p
  join public.roles r on r.id = p.role_id
  join public.permissions perm
    on r.key = 'admin'
    or exists (
      select 1 from public.role_permissions rp
      where rp.role_id = r.id and rp.permission_key = perm.key
    )
  where p.id = auth.uid() and p.status <> 'inativo'
  order by perm.sort_order;
$$;

-- ---------------------------------------------------------------------
-- Travas de negócio
-- ---------------------------------------------------------------------

-- Cargo precisa pertencer à área do colaborador e o nível precisa
-- estar vinculado ao cargo.
create or replace function private.validate_profile_structure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_position_area uuid;
begin
  if new.position_id is not null then
    select area_id into v_position_area from public.positions where id = new.position_id;
    if new.area_id is null then
      new.area_id := v_position_area;
    elsif new.area_id <> v_position_area then
      raise exception 'O cargo selecionado não pertence à área do colaborador.'
        using errcode = 'P0001';
    end if;
  end if;

  if new.level_id is not null and new.position_id is not null and not exists (
    select 1 from public.position_levels
    where position_id = new.position_id and level_id = new.level_id
  ) then
    raise exception 'O nível selecionado não está disponível para este cargo.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Impede escalada de privilégio e garante um administrador ativo.
create or replace function private.guard_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_role_key text;
  v_old_role_key text;
  v_default_role uuid;
begin
  -- Quem age: o usuário da requisição (auth.uid()), não o dono da função.
  if private.is_privileged_session() then
    return new;
  end if;

  select key into v_new_role_key from public.roles where id = new.role_id;

  if tg_op = 'INSERT' then
    select id into v_default_role from public.roles where key = 'colaborador';
    if new.role_id <> v_default_role and not public.has_permission('perfis.gerenciar') then
      raise exception 'Você só pode cadastrar colaboradores com o perfil Colaborador.'
        using errcode = '42501';
    end if;
    if v_new_role_key = 'admin' and not public.is_admin() then
      raise exception 'Somente administradores podem criar outro administrador.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.id <> old.id or lower(new.email) <> lower(old.email) then
    raise exception 'O e-mail de acesso não pode ser alterado por aqui.'
      using errcode = '42501';
  end if;

  if new.role_id is distinct from old.role_id then
    if not public.has_permission('perfis.gerenciar') then
      raise exception 'Você não tem permissão para alterar o perfil de acesso.'
        using errcode = '42501';
    end if;
    if new.id = auth.uid() then
      raise exception 'Você não pode alterar o seu próprio perfil de acesso.'
        using errcode = '42501';
    end if;
    if v_new_role_key = 'admin' and not public.is_admin() then
      raise exception 'Somente administradores podem conceder o perfil Administrador.'
        using errcode = '42501';
    end if;
  end if;

  if new.id = auth.uid() and new.status = 'inativo' and old.status <> 'inativo' then
    raise exception 'Você não pode desativar a sua própria conta.'
      using errcode = '42501';
  end if;

  select key into v_old_role_key from public.roles where id = old.role_id;
  if v_old_role_key = 'admin' and old.status <> 'inativo'
     and (v_new_role_key <> 'admin' or new.status = 'inativo')
     and not exists (
       select 1 from public.profiles p
       join public.roles r on r.id = p.role_id
       where r.key = 'admin' and p.status <> 'inativo' and p.id <> old.id
     ) then
    raise exception 'A plataforma precisa de pelo menos um administrador ativo.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Perfis de fábrica não podem ser excluídos nem ter a chave trocada.
create or replace function private.guard_role_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_privileged_session() then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' and old.is_system then
    raise exception 'Perfis padrão do sistema não podem ser excluídos.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and (new.key <> old.key or new.is_system <> old.is_system) and old.is_system then
    raise exception 'A chave de um perfil padrão não pode ser alterada.' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' and new.is_system then
    raise exception 'Novos perfis não podem ser marcados como perfis do sistema.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

-- Ninguém além do administrador altera as permissões do próprio perfil
-- ou concede a permissão de gerenciar perfis.
create or replace function private.guard_role_permission_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.role_permissions;
  v_role_key text;
begin
  if private.is_privileged_session() or public.is_admin() then
    return coalesce(new, old);
  end if;
  v_row := coalesce(new, old);
  select key into v_role_key from public.roles where id = v_row.role_id;
  if v_role_key = 'admin' then
    raise exception 'O perfil Administrador sempre tem todas as permissões.' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and role_id = v_row.role_id) then
    raise exception 'Você não pode alterar as permissões do seu próprio perfil.' using errcode = '42501';
  end if;
  if v_row.permission_key = 'perfis.gerenciar' then
    raise exception 'Somente administradores podem conceder a gestão de perfis.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function private.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_rec jsonb := coalesce(v_new, v_old);
begin
  -- Não registra atualizações que só mexem em updated_at/last_access_at.
  if tg_op = 'UPDATE'
     and (v_old - 'updated_at' - 'last_access_at') = (v_new - 'updated_at' - 'last_access_at') then
    return null;
  end if;

  insert into public.audit_log (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(v_rec ->> 'id', v_rec ->> 'key', v_rec ->> 'role_id', v_rec ->> 'position_id'),
    v_old,
    v_new
  );
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------

create trigger areas_updated_at     before update on public.areas     for each row execute function private.set_updated_at();
create trigger levels_updated_at    before update on public.levels    for each row execute function private.set_updated_at();
create trigger positions_updated_at before update on public.positions for each row execute function private.set_updated_at();
create trigger roles_updated_at     before update on public.roles     for each row execute function private.set_updated_at();
create trigger profiles_updated_at  before update on public.profiles  for each row execute function private.set_updated_at();

create trigger profiles_structure before insert or update of area_id, position_id, level_id on public.profiles
  for each row execute function private.validate_profile_structure();
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function private.guard_profile_changes();
create trigger roles_guard before insert or update or delete on public.roles
  for each row execute function private.guard_role_changes();
create trigger role_permissions_guard before insert or update or delete on public.role_permissions
  for each row execute function private.guard_role_permission_changes();

create trigger areas_audit            after insert or update or delete on public.areas            for each row execute function private.write_audit_log();
create trigger levels_audit           after insert or update or delete on public.levels           for each row execute function private.write_audit_log();
create trigger positions_audit        after insert or update or delete on public.positions        for each row execute function private.write_audit_log();
create trigger position_levels_audit  after insert or update or delete on public.position_levels  for each row execute function private.write_audit_log();
create trigger roles_audit            after insert or update or delete on public.roles            for each row execute function private.write_audit_log();
create trigger role_permissions_audit after insert or update or delete on public.role_permissions for each row execute function private.write_audit_log();
create trigger profiles_audit         after insert or update or delete on public.profiles         for each row execute function private.write_audit_log();

-- ---------------------------------------------------------------------
-- Funções chamadas pela aplicação
-- ---------------------------------------------------------------------

-- O colaborador pode corrigir o próprio nome, e só isso.
create or replace function public.update_my_profile(p_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  update public.profiles set full_name = btrim(p_full_name) where id = auth.uid();
end;
$$;

-- Registra o último acesso no máximo uma vez a cada 5 minutos.
create or replace function public.touch_last_access()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set last_access_at = now()
  where id = auth.uid()
    and (last_access_at is null or last_access_at < now() - interval '5 minutes');
$$;

-- Move um nível uma posição para cima (-1) ou para baixo (+1) na
-- hierarquia. Executa com as permissões de quem chama (RLS vale).
create or replace function public.move_level(p_level_id uuid, p_direction integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rank integer;
  v_other uuid;
  v_other_rank integer;
begin
  if p_direction not in (-1, 1) then
    raise exception 'Direção inválida.' using errcode = '22023';
  end if;
  select rank into v_rank from public.levels where id = p_level_id;
  if v_rank is null then
    raise exception 'Nível não encontrado.' using errcode = 'P0002';
  end if;
  if p_direction = -1 then
    select id, rank into v_other, v_other_rank from public.levels where rank < v_rank order by rank desc limit 1;
  else
    select id, rank into v_other, v_other_rank from public.levels where rank > v_rank order by rank asc limit 1;
  end if;
  if v_other is null then
    return;
  end if;
  update public.levels set rank = v_other_rank where id = p_level_id;
  update public.levels set rank = v_rank where id = v_other;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.areas            enable row level security;
alter table public.levels           enable row level security;
alter table public.positions        enable row level security;
alter table public.position_levels  enable row level security;
alter table public.roles            enable row level security;
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles         enable row level security;
alter table public.audit_log        enable row level security;

-- Estrutura organizacional: qualquer usuário ativo lê; só quem tem
-- estrutura.gerenciar altera.
create policy areas_select on public.areas for select to authenticated using (public.is_active_user());
create policy areas_write  on public.areas for all    to authenticated
  using (public.has_permission('estrutura.gerenciar')) with check (public.has_permission('estrutura.gerenciar'));

create policy levels_select on public.levels for select to authenticated using (public.is_active_user());
create policy levels_write  on public.levels for all    to authenticated
  using (public.has_permission('estrutura.gerenciar')) with check (public.has_permission('estrutura.gerenciar'));

create policy positions_select on public.positions for select to authenticated using (public.is_active_user());
create policy positions_write  on public.positions for all    to authenticated
  using (public.has_permission('estrutura.gerenciar')) with check (public.has_permission('estrutura.gerenciar'));

create policy position_levels_select on public.position_levels for select to authenticated using (public.is_active_user());
create policy position_levels_write  on public.position_levels for all    to authenticated
  using (public.has_permission('estrutura.gerenciar')) with check (public.has_permission('estrutura.gerenciar'));

-- Perfis e permissões: usuários ativos leem (para montar menus);
-- só quem tem perfis.gerenciar altera.
create policy roles_select on public.roles for select to authenticated using (public.is_active_user());
create policy roles_write  on public.roles for all    to authenticated
  using (public.has_permission('perfis.gerenciar')) with check (public.has_permission('perfis.gerenciar'));

create policy permissions_select on public.permissions for select to authenticated using (public.is_active_user());

create policy role_permissions_select on public.role_permissions for select to authenticated using (public.is_active_user());
create policy role_permissions_write  on public.role_permissions for all    to authenticated
  using (public.has_permission('perfis.gerenciar')) with check (public.has_permission('perfis.gerenciar'));

-- Colaboradores: cada um vê a si mesmo e o próprio supervisor;
-- supervisor vê a própria equipe; quem tem colaboradores.ver vê todos.
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or id = public.my_supervisor_id()
  or public.has_permission('colaboradores.ver')
  or (public.has_permission('equipe.ver') and supervisor_id = auth.uid())
);
create policy profiles_insert on public.profiles for insert to authenticated
  with check (public.has_permission('colaboradores.gerenciar'));
create policy profiles_update on public.profiles for update to authenticated
  using (public.has_permission('colaboradores.gerenciar'))
  with check (public.has_permission('colaboradores.gerenciar'));
-- Sem política de DELETE: colaboradores são desativados, não apagados.

create policy audit_log_select on public.audit_log for select to authenticated
  using (public.has_permission('auditoria.ver'));
-- Sem políticas de escrita: só os gatilhos gravam em audit_log.

-- ---------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------

revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon, public;
-- TRUNCATE ignora RLS; o Supabase concede por padrão e aqui é retirado.
revoke truncate, references, trigger on all tables in schema public from authenticated;

grant select                         on public.areas, public.levels, public.positions, public.position_levels,
                                        public.roles, public.permissions, public.role_permissions,
                                        public.profiles, public.audit_log to authenticated;
grant insert, update, delete         on public.areas, public.levels, public.positions, public.position_levels,
                                        public.roles, public.role_permissions to authenticated;
grant insert, update                 on public.profiles to authenticated;
revoke insert, update, delete        on public.permissions, public.audit_log from authenticated;

grant execute on function public.is_active_user()          to authenticated;
grant execute on function public.is_admin()                to authenticated;
grant execute on function public.has_permission(text)      to authenticated;
grant execute on function public.my_permissions()          to authenticated;
grant execute on function public.my_supervisor_id()        to authenticated;
grant execute on function public.update_my_profile(text)   to authenticated;
grant execute on function public.touch_last_access()       to authenticated;
grant execute on function public.move_level(uuid, integer) to authenticated;
