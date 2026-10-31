-- =====================================================================
-- Identidade visual: cores (claro e escuro) e logomarca
--
-- * Uma linha única (id = 1) com as cores e os arquivos da logomarca.
-- * Leitura e alteração das configurações: somente Administrador.
-- * A aplicação lê só o necessário para desenhar a tela pela função
--   public.get_branding(), que também atende a tela de login.
-- * As cores são validadas no banco (#RRGGBB) e só tokens conhecidos
--   são aceitos, o que impede injetar CSS pela configuração.
-- =====================================================================

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
                    'brand', 'on-brand', 'accent', 'accent-soft', 'icon',
                    'sidebar-bg', 'sidebar-text', 'sidebar-muted', 'sidebar-active-bg', 'sidebar-active-text'
                  )
               or jsonb_typeof(t.value) <> 'string'
               or (t.value #>> '{}') !~ '^#[0-9a-fA-F]{6}$'
          )
     );
$$;

create table if not exists public.app_settings (
  id             smallint primary key default 1 check (id = 1),
  theme          jsonb not null default '{}'::jsonb check (private.valid_theme(theme)),
  logo_path      text check (logo_path is null or logo_path ~ '^logo/[0-9a-f-]{36}\.(png|webp|jpg)$'),
  logo_dark_path text check (logo_dark_path is null or logo_dark_path ~ '^logo/[0-9a-f-]{36}\.(png|webp|jpg)$'),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.profiles(id) on delete set null
);
insert into public.app_settings (id) values (1) on conflict do nothing;

create or replace function private.touch_app_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings
  for each row execute function private.touch_app_settings();
drop trigger if exists app_settings_audit on public.app_settings;
create trigger app_settings_audit after update on public.app_settings
  for each row execute function private.write_audit_log();

alter table public.app_settings enable row level security;
create policy app_settings_select on public.app_settings for select to authenticated using (public.is_admin());
create policy app_settings_update on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Sem insert/delete: existe sempre uma única linha.

revoke all on public.app_settings from anon;
revoke truncate, references, trigger, insert, delete on public.app_settings from authenticated;
grant select, update on public.app_settings to authenticated;

-- O que toda tela precisa para aplicar a identidade visual (sem dados de quem alterou).
create or replace function public.get_branding()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'theme', s.theme,
    'logo_path', s.logo_path,
    'logo_dark_path', s.logo_dark_path,
    'version', extract(epoch from s.updated_at)::bigint
  )
  from public.app_settings s where s.id = 1;
$$;
revoke all on function public.get_branding() from public;
grant execute on function public.get_branding() to anon, authenticated;

-- Arquivos da logomarca: público para leitura, só o Administrador envia.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('branding', 'branding', true, 1048576, array['image/png', 'image/webp', 'image/jpeg'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

    drop policy if exists branding_insert on storage.objects;
    drop policy if exists branding_update on storage.objects;
    drop policy if exists branding_delete on storage.objects;
    drop policy if exists branding_select on storage.objects;
    execute $p$
      create policy branding_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'branding' and public.is_admin())
    $p$;
    execute $p$
      create policy branding_update on storage.objects for update to authenticated
      using (bucket_id = 'branding' and public.is_admin())
    $p$;
    execute $p$
      create policy branding_delete on storage.objects for delete to authenticated
      using (bucket_id = 'branding' and public.is_admin())
    $p$;
    execute $p$
      create policy branding_select on storage.objects for select to authenticated
      using (bucket_id = 'branding' and public.is_admin())
    $p$;
  end if;
end;
$$;
