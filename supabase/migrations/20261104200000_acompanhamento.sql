-- =====================================================================
-- Acompanhamento: quem tem "Ver o progresso de todos" (progresso.ver)
-- precisa ler o cadastro básico das pessoas cujo progresso consulta,
-- mesmo sem a permissão de ver colaboradores. O progresso em si já era
-- liberado por can_view_progress_of().
-- =====================================================================

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or id = public.my_supervisor_id()
  or public.has_permission('colaboradores.ver')
  or public.has_permission('progresso.ver')
  or (public.has_permission('equipe.ver') and supervisor_id = auth.uid())
);
