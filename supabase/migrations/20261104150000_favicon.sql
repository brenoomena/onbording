-- =====================================================================
-- Favicon personalizado (ícone exibido na aba do navegador).
-- Arquivo PNG quadrado gerado pela tela de Configurações.
-- =====================================================================

alter table public.app_settings
  add column if not exists favicon_path text
    check (favicon_path is null or favicon_path ~ '^logo/[0-9a-f-]{36}\.png$');

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
    'symbol_path', s.symbol_path,
    'symbol_dark_path', s.symbol_dark_path,
    'favicon_path', s.favicon_path,
    'logo_sizes', s.logo_sizes,
    'version', extract(epoch from s.updated_at)::bigint
  )
  from public.app_settings s where s.id = 1;
$$;
revoke all on function public.get_branding() from public;
grant execute on function public.get_branding() to anon, authenticated;
