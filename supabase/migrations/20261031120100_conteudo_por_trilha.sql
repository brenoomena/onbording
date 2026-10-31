-- =====================================================================
-- Cada conteúdo pertence a uma trilha (ou é só material da Biblioteca)
--
-- * contents.track_id: a trilha dona do conteúdo.
-- * Sem trilha, o conteúdo precisa estar na Biblioteca de materiais.
-- * Uma trilha só aceita, nos seus módulos, conteúdos que pertencem a ela.
-- * Os conteúdos existentes são vinculados à trilha onde já estão.
-- =====================================================================

alter table public.contents
  add column if not exists track_id uuid references public.tracks(id) on delete restrict;
create index if not exists contents_track_idx on public.contents (track_id);

-- Vincula cada conteúdo existente à trilha em que já aparece (a primeira, se houver mais de uma).
update public.contents c
set track_id = x.track_id
from (
  select distinct on (mi.content_id) mi.content_id, m.track_id
  from public.module_items mi
  join public.modules m on m.id = mi.module_id
  order by mi.content_id, m.position, mi.position
) x
where x.content_id = c.id and c.track_id is null;

-- Sem trilha, só como material da Biblioteca. Conteúdos antigos fora de
-- qualquer trilha (se houver) continuam como estão até a próxima edição.
alter table public.contents drop constraint if exists contents_track_or_library;
alter table public.contents add constraint contents_track_or_library
  check (track_id is not null or is_library) not valid;
do $$
begin
  if not exists (select 1 from public.contents where track_id is null and not is_library) then
    alter table public.contents validate constraint contents_track_or_library;
  end if;
end;
$$;

-- A trilha só recebe conteúdos que pertencem a ela.
create or replace function private.check_module_item_track()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_module_track uuid;
  v_content_track uuid;
begin
  select track_id into v_module_track from public.modules where id = new.module_id;
  select track_id into v_content_track from public.contents where id = new.content_id;
  if v_content_track is distinct from v_module_track then
    raise exception 'Este conteúdo pertence a outra trilha. Cadastre o conteúdo nesta trilha para incluí-lo.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists module_items_track_check on public.module_items;
create trigger module_items_track_check before insert or update of module_id, content_id on public.module_items
  for each row execute function private.check_module_item_track();

-- Mudar a trilha de um conteúdo só depois de tirá-lo dos módulos da trilha antiga.
create or replace function private.check_content_track_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.track_id is distinct from old.track_id and exists (
    select 1 from public.module_items mi
    join public.modules m on m.id = mi.module_id
    where mi.content_id = new.id and m.track_id is distinct from new.track_id
  ) then
    raise exception 'Este conteúdo está nos módulos de outra trilha. Remova-o de lá antes de mudar a trilha.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists contents_track_change on public.contents;
create trigger contents_track_change before update of track_id on public.contents
  for each row execute function private.check_content_track_change();
