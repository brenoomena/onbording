-- Fixa o search_path das funções auxiliares (alerta do linter de segurança do Supabase).
alter function private.set_updated_at() set search_path = '';
alter function private.is_privileged_session() set search_path = '';
