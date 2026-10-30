-- Foto de perfil: cada pessoa envia a sua; a imagem fica num bucket público
-- (endereço impossível de adivinhar), dentro de uma pasta com o id da pessoa.

alter table public.profiles add column if not exists avatar_path text
  check (avatar_path is null or length(avatar_path) between 10 and 300);

-- A pessoa só troca a própria foto, e só por um arquivo da própria pasta.
create or replace function public.set_my_avatar(p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  if p_path is not null and (p_path not like auth.uid()::text || '/%' or p_path like '%..%') then
    raise exception 'Arquivo de foto inválido.' using errcode = '22023';
  end if;
  select avatar_path into v_old from public.profiles where id = auth.uid();
  update public.profiles set avatar_path = p_path where id = auth.uid();
  return v_old;
end;
$$;

revoke all on function public.set_my_avatar(text) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

    execute $p$
      create policy avatars_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    execute $p$
      create policy avatars_update on storage.objects for update to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    execute $p$
      create policy avatars_delete on storage.objects for delete to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    -- Leitura da lista do bucket só da própria pasta (as imagens abrem pelo endereço público).
    execute $p$
      create policy avatars_select on storage.objects for select to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
  end if;
end;
$$;
