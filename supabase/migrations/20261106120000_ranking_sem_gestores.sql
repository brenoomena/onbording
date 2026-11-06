-- Ranking só com colaboradores: Administrador e Supervisor não entram.
create or replace function public.points_ranking(p_area uuid default null, p_month boolean default false)
returns table (profile_id uuid, full_name text, avatar_path text, area_name text, points integer, badges integer, rank integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_my_area uuid;
  v_area uuid;
  v_since timestamptz := case when p_month then date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' else '-infinity'::timestamptz end;
begin
  if auth.uid() is null or not public.is_active_user() then
    return;
  end if;
  select area_id into v_my_area from public.profiles where id = auth.uid();
  v_area := coalesce(p_area, v_my_area);
  if v_area is distinct from v_my_area and not private.sees_all_areas() then
    raise exception 'Você vê apenas o ranking da sua área.' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, p.avatar_path, ar.name,
           coalesce(sum(l.points), 0)::int as pts,
           (select count(*)::int from public.user_badges b where b.profile_id = p.id),
           (rank() over (order by coalesce(sum(l.points), 0) desc))::int
    from public.profiles p
    join public.roles ro on ro.id = p.role_id and ro.key not in ('admin', 'supervisor')
    left join public.areas ar on ar.id = p.area_id
    left join public.points_ledger l on l.profile_id = p.id and l.created_at >= v_since
    where p.status <> 'inativo'
      and (p.area_id = v_area or (v_area is null and p.area_id is null and p.id = auth.uid()))
    group by p.id, p.full_name, p.avatar_path, ar.name
    order by pts desc, p.full_name
    limit 200;
end;
$$;
revoke all on function public.points_ranking(uuid, boolean) from public;
grant execute on function public.points_ranking(uuid, boolean) to authenticated;
