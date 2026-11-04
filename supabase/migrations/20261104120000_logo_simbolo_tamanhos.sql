-- =====================================================================
-- Símbolo da marca para o menu recolhido (claro e escuro) e tamanho de
-- exibição de cada logo, com limites mínimos e máximos.
-- =====================================================================

alter table public.app_settings
  add column if not exists symbol_path text
    check (symbol_path is null or symbol_path ~ '^logo/[0-9a-f-]{36}\.(png|webp|jpg)$'),
  add column if not exists symbol_dark_path text
    check (symbol_dark_path is null or symbol_dark_path ~ '^logo/[0-9a-f-]{36}\.(png|webp|jpg)$'),
  add column if not exists logo_sizes jsonb not null default '{}'::jsonb;

-- Tamanhos em pixels: logo de 80 a 220 de largura e 20 a 80 de altura;
-- símbolo de 24 a 52 nos dois lados. A proporção é mantida pela aplicação.
create or replace function private.valid_logo_sizes(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p) = 'object'
     and not exists (
       select 1
       from jsonb_each(p) s
       where s.key not in ('logo', 'logo_dark', 'symbol', 'symbol_dark')
          or jsonb_typeof(s.value) <> 'object'
          or jsonb_typeof(s.value -> 'w') <> 'number'
          or jsonb_typeof(s.value -> 'h') <> 'number'
          or exists (select 1 from jsonb_object_keys(s.value) k where k not in ('w', 'h'))
          or (s.value ->> 'w')::numeric <> trunc((s.value ->> 'w')::numeric)
          or (s.value ->> 'h')::numeric <> trunc((s.value ->> 'h')::numeric)
          or (s.key like 'logo%' and not (
                (s.value ->> 'w')::numeric between 80 and 220
            and (s.value ->> 'h')::numeric between 20 and 80))
          or (s.key like 'symbol%' and not (
                (s.value ->> 'w')::numeric between 24 and 52
            and (s.value ->> 'h')::numeric between 24 and 52))
     );
$$;

alter table public.app_settings drop constraint if exists app_settings_logo_sizes_check;
alter table public.app_settings add constraint app_settings_logo_sizes_check
  check (private.valid_logo_sizes(logo_sizes));

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
    'logo_sizes', s.logo_sizes,
    'version', extract(epoch from s.updated_at)::bigint
  )
  from public.app_settings s where s.id = 1;
$$;
revoke all on function public.get_branding() from public;
grant execute on function public.get_branding() to anon, authenticated;

