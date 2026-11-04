-- =====================================================================
-- 1) Mover um conteúdo para outra trilha (ou para a Biblioteca) numa única
--    operação: tira o conteúdo dos módulos da trilha antiga e troca a
--    trilha. Um conteúdo continua pertencendo a no máximo uma trilha.
-- 2) Novas cores da identidade visual: fundo dos ícones e fundo do título
--    das páginas (antes as duas usavam o "destaque suave").
-- =====================================================================

create or replace function public.move_content_to_track(p_content uuid, p_track uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old uuid;
  v_removed integer := 0;
begin
  if not public.has_permission('conteudos.editar') then
    raise exception 'Sem permissão para editar conteúdos.' using errcode = '42501';
  end if;

  select track_id into v_old from public.contents where id = p_content for update;
  if not found then
    raise exception 'Conteúdo não encontrado.' using errcode = 'P0002';
  end if;
  if p_track is not distinct from v_old then
    return 0;
  end if;
  if p_track is not null and not exists (
    select 1 from public.tracks where id = p_track and status <> 'arquivado'
  ) then
    raise exception 'Trilha de destino não encontrada ou arquivada.' using errcode = '23514';
  end if;

  -- Tirar dos módulos da trilha antiga altera a estrutura dela.
  if exists (
    select 1 from public.module_items mi
    join public.modules m on m.id = mi.module_id
    where mi.content_id = p_content and m.track_id is distinct from p_track
  ) and not public.has_permission('trilhas.editar') then
    raise exception 'O conteúdo está nos módulos da trilha atual. Para movê-lo é preciso também a permissão de editar trilhas.'
      using errcode = '42501';
  end if;

  delete from public.module_items mi
  using public.modules m
  where m.id = mi.module_id and mi.content_id = p_content and m.track_id is distinct from p_track;
  get diagnostics v_removed = row_count;

  update public.contents
     set track_id = p_track,
         -- Sem trilha, o conteúdo só existe como material da Biblioteca.
         is_library = case when p_track is null then true else is_library end
   where id = p_content;

  return v_removed;
end;
$$;
revoke all on function public.move_content_to_track(uuid, uuid) from public;
grant execute on function public.move_content_to_track(uuid, uuid) to authenticated;

create or replace function private.valid_theme(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p) = 'object'
     and not exists (select 1 from jsonb_object_keys(p) k where k not in ('light', 'dark'))
     and not exists (
       select 1
       from jsonb_each(p) m
       where jsonb_typeof(m.value) <> 'object'
          or exists (
            select 1 from jsonb_each(m.value) t
            where t.key not in (
                    'bg', 'surface', 'sunken', 'ink', 'heading', 'muted', 'line',
                    'brand', 'on-brand', 'accent', 'accent-soft', 'icon', 'icon-bg', 'header-bg',
                    'sidebar-bg', 'sidebar-text', 'sidebar-muted', 'sidebar-active-bg', 'sidebar-active-text'
                  )
               or jsonb_typeof(t.value) <> 'string'
               or (t.value #>> '{}') !~ '^#[0-9a-fA-F]{6}$'
          )
     );
$$;
