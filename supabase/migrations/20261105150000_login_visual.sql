-- =====================================================================
-- Aparência da página de login: degradê, efeito animado, textos, cartão e
-- botão. Guardado como JSON (só o que difere do padrão) e lido pela função
-- pública get_branding(), já que a página de login é vista sem sessão.
-- =====================================================================

alter table public.app_settings
  add column if not exists login_theme jsonb not null default '{}'::jsonb
    check (jsonb_typeof(login_theme) = 'object' and pg_column_size(login_theme) < 8000);

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
    'login_theme', s.login_theme,
    'version', extract(epoch from s.updated_at)::bigint
  )
  from public.app_settings s where s.id = 1;
$$;
revoke all on function public.get_branding() from public;
grant execute on function public.get_branding() to anon, authenticated;
