-- =====================================================================
-- Permissões por ação (ver, criar, editar, excluir) e ajuste por usuário
--
-- * Cada módulo passa a ter permissões separadas por ação.
-- * O perfil de acesso define o padrão; o Administrador pode liberar ou
--   bloquear permissões de um usuário específico (user_permissions).
-- * Perfis de acesso, permissões e configurações do sistema passam a ser
--   exclusivos do perfil Administrador (não há mais permissão delegável).
--
-- Preserva os acessos atuais: quem tinha "X.gerenciar" recebe todas as
-- ações equivalentes do módulo X.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Catálogo de permissões
-- ---------------------------------------------------------------------
insert into public.permissions (key, module, name, description, sort_order) values
  ('painel.ver',              'Painel',        'Ver o painel',                    'Acessa a página inicial com os indicadores do seu alcance.', 10),
  ('colaboradores.ver',       'Colaboradores', 'Ver todos os colaboradores',      'Consulta o cadastro de todos os colaboradores.', 20),
  ('equipe.ver',              'Colaboradores', 'Ver a própria equipe',            'Consulta os colaboradores dos quais é supervisor.', 21),
  ('colaboradores.criar',     'Colaboradores', 'Cadastrar colaboradores',         'Cadastra colaboradores e envia o convite de acesso.', 22),
  ('colaboradores.editar',    'Colaboradores', 'Editar colaboradores',            'Altera dados, área, cargo, nível e supervisor.', 23),
  ('colaboradores.desativar', 'Colaboradores', 'Desativar e reativar',            'Bloqueia ou libera o acesso de um colaborador.', 24),
  ('estrutura.criar',         'Estrutura',     'Criar áreas, cargos e níveis',    'Cadastra novos itens da estrutura organizacional.', 30),
  ('estrutura.editar',        'Estrutura',     'Editar áreas, cargos e níveis',   'Altera, ativa, desativa e reordena itens da estrutura.', 31),
  ('estrutura.excluir',       'Estrutura',     'Excluir áreas, cargos e níveis',  'Exclui itens da estrutura que não estão em uso.', 32),
  ('trilhas.ver',             'Trilhas',       'Ver a gestão de trilhas',         'Consulta todas as trilhas, inclusive rascunhos.', 40),
  ('trilhas.criar',           'Trilhas',       'Criar trilhas',                   'Cadastra novas trilhas.', 41),
  ('trilhas.editar',          'Trilhas',       'Editar e publicar trilhas',       'Altera trilhas, módulos, público e publicação.', 42),
  ('trilhas.excluir',         'Trilhas',       'Excluir trilhas',                 'Exclui trilhas sem matrículas.', 43),
  ('trilhas.matricular',      'Trilhas',       'Gerenciar matrículas',            'Matricula, define prazos e acompanha as jornadas.', 44),
  ('conteudos.ver',           'Conteúdos',     'Ver a gestão de conteúdos',       'Consulta todos os conteúdos, inclusive rascunhos.', 50),
  ('conteudos.criar',         'Conteúdos',     'Criar conteúdos',                 'Cadastra conteúdos e envia arquivos.', 51),
  ('conteudos.editar',        'Conteúdos',     'Editar e publicar conteúdos',     'Altera, publica e arquiva conteúdos.', 52),
  ('conteudos.excluir',       'Conteúdos',     'Excluir conteúdos',               'Exclui conteúdos que não estão em uso.', 53),
  ('progresso.ver',           'Relatórios',    'Ver o progresso de todos',        'Consulta trilhas, progresso e tempo de estudo de todos.', 60),
  ('auditoria.ver',           'Relatórios',    'Ver o registro de auditoria',     'Consulta quem alterou o quê e quando.', 61)
on conflict (key) do update
  set module = excluded.module, name = excluded.name,
      description = excluded.description, sort_order = excluded.sort_order;

-- Converte "gerenciar" nas ações equivalentes, mantendo o acesso de cada perfil.
insert into public.role_permissions (role_id, permission_key)
select rp.role_id, m.new_key
from public.role_permissions rp
join (values
  ('colaboradores.gerenciar', 'colaboradores.criar'),
  ('colaboradores.gerenciar', 'colaboradores.editar'),
  ('colaboradores.gerenciar', 'colaboradores.desativar'),
  ('estrutura.gerenciar',     'estrutura.criar'),
  ('estrutura.gerenciar',     'estrutura.editar'),
  ('estrutura.gerenciar',     'estrutura.excluir'),
  ('trilhas.gerenciar',       'trilhas.ver'),
  ('trilhas.gerenciar',       'trilhas.criar'),
  ('trilhas.gerenciar',       'trilhas.editar'),
  ('trilhas.gerenciar',       'trilhas.excluir'),
  ('trilhas.gerenciar',       'trilhas.matricular'),
  ('conteudos.gerenciar',     'conteudos.ver'),
  ('conteudos.gerenciar',     'conteudos.criar'),
  ('conteudos.gerenciar',     'conteudos.editar'),
  ('conteudos.gerenciar',     'conteudos.excluir')
) as m(old_key, new_key) on m.old_key = rp.permission_key
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2. Ajuste de permissões por usuário
-- ---------------------------------------------------------------------
create table if not exists public.user_permissions (
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade on update cascade,
  allowed        boolean not null,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  primary key (profile_id, permission_key)
);
comment on table public.user_permissions is
  'Exceções por usuário ao padrão do perfil: allowed=true libera, allowed=false bloqueia.';

-- O gatilho de auditoria passa a identificar também registros por pessoa.
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
  if tg_op = 'UPDATE'
     and (v_old - 'updated_at' - 'last_access_at') = (v_new - 'updated_at' - 'last_access_at') then
    return null;
  end if;

  insert into public.audit_log (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(v_rec ->> 'id', v_rec ->> 'key', v_rec ->> 'role_id', v_rec ->> 'position_id', v_rec ->> 'profile_id'),
    v_old,
    v_new
  );
  return null;
end;
$$;

-- Somente o Administrador ajusta permissões, e nunca as próprias.
create or replace function private.guard_user_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.user_permissions := coalesce(new, old);
begin
  if private.is_privileged_session() then
    return coalesce(new, old);
  end if;
  if not public.is_admin() then
    raise exception 'Somente administradores ajustam permissões de usuários.' using errcode = '42501';
  end if;
  if v_row.profile_id = auth.uid() then
    raise exception 'Você não pode alterar as suas próprias permissões.' using errcode = '42501';
  end if;
  if tg_op <> 'DELETE' then
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists user_permissions_guard on public.user_permissions;
create trigger user_permissions_guard before insert or update or delete on public.user_permissions
  for each row execute function private.guard_user_permissions();
drop trigger if exists user_permissions_audit on public.user_permissions;
create trigger user_permissions_audit after insert or update or delete on public.user_permissions
  for each row execute function private.write_audit_log();

alter table public.user_permissions enable row level security;
create policy user_permissions_select on public.user_permissions for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());
create policy user_permissions_write on public.user_permissions for all to authenticated
  using (public.is_admin() and profile_id <> auth.uid())
  with check (public.is_admin() and profile_id <> auth.uid());

revoke all on public.user_permissions from anon;
revoke truncate, references, trigger on public.user_permissions from authenticated;
grant select, insert, update, delete on public.user_permissions to authenticated;

-- ---------------------------------------------------------------------
-- 3. Verificação de permissão: perfil + ajuste do usuário
-- ---------------------------------------------------------------------
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
        or coalesce(
          (select up.allowed from public.user_permissions up
            where up.profile_id = p.id and up.permission_key = p_key),
          exists (select 1 from public.role_permissions rp
                  where rp.role_id = r.id and rp.permission_key = p_key)
        )
      )
  );
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
    or coalesce(
      (select up.allowed from public.user_permissions up
        where up.profile_id = p.id and up.permission_key = perm.key),
      exists (select 1 from public.role_permissions rp
              where rp.role_id = r.id and rp.permission_key = perm.key)
    )
  where p.id = auth.uid() and p.status <> 'inativo'
  order by perm.sort_order;
$$;

-- ---------------------------------------------------------------------
-- 4. Travas: perfil de acesso só o Administrador altera; desativar exige
--    a permissão própria
-- ---------------------------------------------------------------------
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
  if private.is_privileged_session() then
    return new;
  end if;

  select key into v_new_role_key from public.roles where id = new.role_id;

  if tg_op = 'INSERT' then
    select id into v_default_role from public.roles where key = 'colaborador';
    if new.role_id <> v_default_role and not public.is_admin() then
      raise exception 'Somente administradores cadastram pessoas com outro perfil além de Colaborador.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.id <> old.id or lower(new.email) <> lower(old.email) then
    raise exception 'O e-mail de acesso não pode ser alterado por aqui.' using errcode = '42501';
  end if;

  -- O cadastro de um administrador só é alterado por administradores
  -- (exceto o próprio nome e foto, pelas funções de Meu perfil).
  select key into v_old_role_key from public.roles where id = old.role_id;
  if v_old_role_key = 'admin' and not public.is_admin() then
    raise exception 'Somente administradores alteram o cadastro de um administrador.' using errcode = '42501';
  end if;

  if new.role_id is distinct from old.role_id then
    if not public.is_admin() then
      raise exception 'Somente administradores alteram o perfil de acesso.' using errcode = '42501';
    end if;
    if new.id = auth.uid() then
      raise exception 'Você não pode alterar o seu próprio perfil de acesso.' using errcode = '42501';
    end if;
  end if;

  if (new.status = 'inativo') is distinct from (old.status = 'inativo') then
    if not public.has_permission('colaboradores.desativar') then
      raise exception 'Você não tem permissão para desativar ou reativar colaboradores.' using errcode = '42501';
    end if;
    if new.id = auth.uid() and new.status = 'inativo' then
      raise exception 'Você não pode desativar a sua própria conta.' using errcode = '42501';
    end if;
  end if;

  if v_old_role_key = 'admin' and old.status <> 'inativo'
     and (v_new_role_key <> 'admin' or new.status = 'inativo')
     and not exists (
       select 1 from public.profiles p
       join public.roles r on r.id = p.role_id
       where r.key = 'admin' and p.status <> 'inativo' and p.id <> old.id
     ) then
    raise exception 'A plataforma precisa de pelo menos um administrador ativo.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function private.guard_role_permission_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.role_permissions := coalesce(new, old);
  v_role_key text;
begin
  if private.is_privileged_session() then
    return coalesce(new, old);
  end if;
  if not public.is_admin() then
    raise exception 'Somente administradores alteram permissões de perfis.' using errcode = '42501';
  end if;
  select key into v_role_key from public.roles where id = v_row.role_id;
  if v_role_key = 'admin' then
    raise exception 'O perfil Administrador sempre tem todas as permissões.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Políticas por ação
-- ---------------------------------------------------------------------

-- Estrutura organizacional
do $$
declare t text;
begin
  foreach t in array array['areas', 'levels', 'positions'] loop
    execute format('drop policy if exists %1$s_write on public.%1$s', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format($p$create policy %1$s_insert on public.%1$s for insert to authenticated
      with check (public.has_permission('estrutura.criar'))$p$, t);
    execute format($p$create policy %1$s_update on public.%1$s for update to authenticated
      using (public.has_permission('estrutura.editar')) with check (public.has_permission('estrutura.editar'))$p$, t);
    execute format($p$create policy %1$s_delete on public.%1$s for delete to authenticated
      using (public.has_permission('estrutura.excluir'))$p$, t);
  end loop;
end;
$$;
drop policy if exists position_levels_write on public.position_levels;
create policy position_levels_write on public.position_levels for all to authenticated
  using (public.has_permission('estrutura.criar') or public.has_permission('estrutura.editar'))
  with check (public.has_permission('estrutura.criar') or public.has_permission('estrutura.editar'));

-- Perfis de acesso: exclusivo do Administrador
drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists role_permissions_write on public.role_permissions;
create policy role_permissions_write on public.role_permissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Colaboradores
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (public.has_permission('colaboradores.criar'));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (public.has_permission('colaboradores.editar') or public.has_permission('colaboradores.desativar'))
  with check (public.has_permission('colaboradores.editar') or public.has_permission('colaboradores.desativar'));

-- Quem só pode desativar não altera os demais dados.
create or replace function private.guard_profile_edit_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_privileged_session() or public.has_permission('colaboradores.editar') then
    return new;
  end if;
  if (to_jsonb(new) - 'status' - 'updated_at' - 'last_access_at' - 'avatar_path' - 'full_name')
     <> (to_jsonb(old) - 'status' - 'updated_at' - 'last_access_at' - 'avatar_path' - 'full_name')
     or (new.full_name <> old.full_name and new.id <> auth.uid())
     or (new.avatar_path is distinct from old.avatar_path and new.id <> auth.uid()) then
    raise exception 'Você não tem permissão para editar os dados deste colaborador.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_edit_scope on public.profiles;
create trigger profiles_edit_scope before update on public.profiles
  for each row execute function private.guard_profile_edit_scope();

-- Aprendizagem: leitura de gestão
create or replace function public.can_view_track(p_track uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission('trilhas.ver')
      or public.has_permission('trilhas.matricular')
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
  select public.has_permission('conteudos.ver')
      or public.has_permission('trilhas.ver')
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

create or replace function public.can_view_progress_of(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile = auth.uid()
      or public.has_permission('progresso.ver')
      or public.has_permission('trilhas.matricular')
      or (public.has_permission('equipe.ver')
          and exists (select 1 from public.profiles where id = p_profile and supervisor_id = auth.uid()));
$$;

-- Conteúdos
drop policy if exists contents_write on public.contents;
drop policy if exists contents_insert on public.contents;
drop policy if exists contents_update on public.contents;
drop policy if exists contents_delete on public.contents;
create policy contents_insert on public.contents for insert to authenticated
  with check (public.has_permission('conteudos.criar'));
create policy contents_update on public.contents for update to authenticated
  using (public.has_permission('conteudos.editar')) with check (public.has_permission('conteudos.editar'));
create policy contents_delete on public.contents for delete to authenticated
  using (public.has_permission('conteudos.excluir'));

-- Trilhas
drop policy if exists tracks_write on public.tracks;
drop policy if exists tracks_insert on public.tracks;
drop policy if exists tracks_update on public.tracks;
drop policy if exists tracks_delete on public.tracks;
create policy tracks_insert on public.tracks for insert to authenticated
  with check (public.has_permission('trilhas.criar'));
create policy tracks_update on public.tracks for update to authenticated
  using (public.has_permission('trilhas.editar')) with check (public.has_permission('trilhas.editar'));
create policy tracks_delete on public.tracks for delete to authenticated
  using (public.has_permission('trilhas.excluir'));

drop policy if exists modules_write on public.modules;
create policy modules_write on public.modules for all to authenticated
  using (public.has_permission('trilhas.editar')) with check (public.has_permission('trilhas.editar'));

drop policy if exists module_items_write on public.module_items;
create policy module_items_write on public.module_items for all to authenticated
  using (public.has_permission('trilhas.editar')) with check (public.has_permission('trilhas.editar'));

drop policy if exists audience_rules_select on public.audience_rules;
create policy audience_rules_select on public.audience_rules for select to authenticated
  using (public.has_permission('trilhas.ver') or public.has_permission('conteudos.ver'));
drop policy if exists audience_rules_write on public.audience_rules;
create policy audience_rules_write on public.audience_rules for all to authenticated
  using (
    (track_id is not null and (public.has_permission('trilhas.criar') or public.has_permission('trilhas.editar')))
    or (content_id is not null and (public.has_permission('conteudos.criar') or public.has_permission('conteudos.editar')))
  )
  with check (
    (track_id is not null and (public.has_permission('trilhas.criar') or public.has_permission('trilhas.editar')))
    or (content_id is not null and (public.has_permission('conteudos.criar') or public.has_permission('conteudos.editar')))
  );

drop policy if exists enrollments_write on public.enrollments;
create policy enrollments_write on public.enrollments for all to authenticated
  using (public.has_permission('trilhas.matricular')) with check (public.has_permission('trilhas.matricular'));

-- Arquivos dos conteúdos
do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists conteudos_read on storage.objects;
    drop policy if exists conteudos_insert on storage.objects;
    drop policy if exists conteudos_update on storage.objects;
    drop policy if exists conteudos_delete on storage.objects;
    execute $p$
      create policy conteudos_read on storage.objects for select to authenticated
      using (
        bucket_id = 'conteudos'
        and (
          public.has_permission('conteudos.ver')
          or exists (select 1 from public.contents c where c.storage_path = objects.name and public.can_view_content(c.id))
        )
      )
    $p$;
    execute $p$
      create policy conteudos_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'conteudos' and (public.has_permission('conteudos.criar') or public.has_permission('conteudos.editar')))
    $p$;
    execute $p$
      create policy conteudos_update on storage.objects for update to authenticated
      using (bucket_id = 'conteudos' and public.has_permission('conteudos.editar'))
    $p$;
    execute $p$
      create policy conteudos_delete on storage.objects for delete to authenticated
      using (bucket_id = 'conteudos' and (public.has_permission('conteudos.editar') or public.has_permission('conteudos.excluir')))
    $p$;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Remove as permissões antigas (já convertidas acima)
-- ---------------------------------------------------------------------
delete from public.role_permissions
where permission_key in ('colaboradores.gerenciar', 'estrutura.gerenciar', 'trilhas.gerenciar',
                         'conteudos.gerenciar', 'perfis.gerenciar');
delete from public.permissions
where key in ('colaboradores.gerenciar', 'estrutura.gerenciar', 'trilhas.gerenciar',
              'conteudos.gerenciar', 'perfis.gerenciar');
