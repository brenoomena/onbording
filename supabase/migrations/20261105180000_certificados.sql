-- =====================================================================
-- Certificados de conclusão de trilha.
--
-- * Emitido automaticamente quando a matrícula chega a "concluída" (todas
--   as etapas obrigatórias, inclusive aprovação nas avaliações).
-- * Guarda uma cópia dos dados (nome, trilha, carga horária, média): o
--   certificado não muda se o cadastro ou a trilha mudarem depois.
-- * Código de validação público: qualquer pessoa confere em
--   /certificado/<código> sem entrar no sistema (verify_certificate).
-- * Modelo visual em app_settings.certificate_theme (Configurações).
-- =====================================================================

-- Carga horária informada no certificado (horas). Sem valor, soma o tempo
-- estimado dos conteúdos da trilha.
alter table public.tracks
  add column if not exists certificate_hours numeric(5, 1)
    check (certificate_hours is null or certificate_hours between 0.5 and 999);

alter table public.app_settings
  add column if not exists certificate_theme jsonb not null default '{}'::jsonb
    check (jsonb_typeof(certificate_theme) = 'object' and pg_column_size(certificate_theme) < 8000);

create table if not exists public.certificates (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (code ~ '^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$'),
  profile_id     uuid not null references public.profiles (id) on delete restrict,
  track_id       uuid not null references public.tracks (id) on delete restrict,
  enrollment_id  uuid references public.enrollments (id) on delete set null,
  person_name    text not null,
  track_name     text not null,
  hours          numeric(6, 1),
  average_score  numeric(5, 2),
  completed_at   timestamptz not null,
  issued_at      timestamptz not null default now(),
  constraint certificates_unique unique (profile_id, track_id)
);
create index if not exists certificates_track_idx on public.certificates (track_id);

alter table public.certificates enable row level security;
-- A própria pessoa e quem acompanha o progresso dela. Gravação só pelo banco.
drop policy if exists certificates_select on public.certificates;
create policy certificates_select on public.certificates for select to authenticated using (
  public.is_active_user() and (profile_id = auth.uid() or public.can_view_progress_of(profile_id))
);
revoke all on public.certificates from anon, authenticated;
grant select on public.certificates to authenticated;

-- Emite (uma vez) o certificado de uma matrícula concluída.
create or replace function private.issue_certificate(p_enrollment uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.enrollments;
  v_id uuid;
  v_hours numeric;
  v_avg numeric;
  v_code text;
begin
  select * into e from public.enrollments where id = p_enrollment;
  if e.id is null or e.status <> 'concluida' then
    return null;
  end if;
  select id into v_id from public.certificates where profile_id = e.profile_id and track_id = e.track_id;
  if v_id is not null then
    return v_id;
  end if;

  select coalesce(
           t.certificate_hours,
           (select round(sum(c.estimated_minutes) / 60.0, 1)
              from public.modules m
              join public.module_items mi on mi.module_id = m.id
              join public.contents c on c.id = mi.content_id
             where m.track_id = t.id and c.estimated_minutes is not null)
         )
    into v_hours
  from public.tracks t where t.id = e.track_id;

  -- Média: melhor nota da pessoa em cada avaliação da trilha.
  select round(avg(best), 2) into v_avg
  from (
    select max(qa.score) as best
    from public.modules m
    join public.module_items mi on mi.module_id = m.id
    join public.quiz_attempts qa on qa.content_id = mi.content_id and qa.profile_id = e.profile_id
    where m.track_id = e.track_id and qa.status <> 'em_correcao'
    group by mi.content_id
  ) s;

  loop
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 4) || '-' || substr(md5(gen_random_uuid()::text), 1, 4) || '-' || substr(md5(gen_random_uuid()::text), 1, 4));
    exit when not exists (select 1 from public.certificates where code = v_code);
  end loop;

  insert into public.certificates (code, profile_id, track_id, enrollment_id, person_name, track_name, hours, average_score, completed_at)
  select v_code, e.profile_id, e.track_id, e.id, p.full_name, t.name, nullif(v_hours, 0), v_avg, coalesce(e.completed_at, now())
  from public.profiles p, public.tracks t
  where p.id = e.profile_id and t.id = e.track_id
  on conflict (profile_id, track_id) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.enrollment_certificate_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'concluida' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform private.issue_certificate(new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists enrollments_certificate on public.enrollments;
create trigger enrollments_certificate after insert or update of status on public.enrollments
  for each row execute function private.enrollment_certificate_trigger();

-- Quem já concluiu antes desta versão também recebe o certificado.
do $$
declare
  v uuid;
begin
  for v in select id from public.enrollments where status = 'concluida' loop
    perform private.issue_certificate(v);
  end loop;
end;
$$;

-- Validação pública (sem login): só o necessário para conferir.
create or replace function public.verify_certificate(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'code', c.code,
    'person_name', c.person_name,
    'track_name', c.track_name,
    'hours', c.hours,
    'average_score', c.average_score,
    'completed_at', c.completed_at,
    'issued_at', c.issued_at
  )
  from public.certificates c
  where c.code = upper(btrim(coalesce(p_code, '')));
$$;
revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- O modelo do certificado vai junto da identidade visual (lida sem login).
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
    'certificate_theme', s.certificate_theme,
    'version', extract(epoch from s.updated_at)::bigint
  )
  from public.app_settings s where s.id = 1;
$$;
revoke all on function public.get_branding() from public;
grant execute on function public.get_branding() to anon, authenticated;
