-- =====================================================================
-- Etapa 1 · Dados iniciais
-- Permissões da Etapa 1, perfis de fábrica, áreas e níveis iniciais.
-- Idempotente: pode ser executado mais de uma vez sem duplicar dados.
-- =====================================================================

insert into public.permissions (key, module, name, description, sort_order) values
  ('painel.ver',              'Painel',            'Ver o painel',                         'Acessa a página inicial com os indicadores do seu alcance.', 10),
  ('colaboradores.ver',       'Colaboradores',     'Ver todos os colaboradores',           'Consulta o cadastro de todos os colaboradores.', 20),
  ('colaboradores.gerenciar', 'Colaboradores',     'Cadastrar e editar colaboradores',     'Convida, edita, ativa e desativa colaboradores.', 21),
  ('equipe.ver',              'Colaboradores',     'Ver a própria equipe',                 'Consulta os colaboradores dos quais é supervisor.', 22),
  ('estrutura.gerenciar',     'Estrutura',         'Gerenciar áreas, cargos e níveis',     'Cria, edita, desativa e exclui áreas, cargos e níveis.', 30),
  ('perfis.gerenciar',        'Perfis de acesso',  'Gerenciar perfis e permissões',        'Cria perfis, define permissões e altera o perfil dos colaboradores.', 40),
  ('auditoria.ver',           'Auditoria',         'Ver o registro de auditoria',          'Consulta quem alterou o quê e quando.', 50)
on conflict (key) do update
  set module = excluded.module, name = excluded.name,
      description = excluded.description, sort_order = excluded.sort_order;

insert into public.roles (key, name, description, is_system) values
  ('admin',       'Administrador', 'Acesso completo à plataforma. Tem sempre todas as permissões.', true),
  ('supervisor',  'Supervisor',    'Acompanha a própria equipe.', true),
  ('colaborador', 'Colaborador',   'Acessa o próprio painel e os conteúdos liberados.', true)
on conflict (key) do nothing;

-- O administrador recebe todas as permissões explicitamente para que a
-- tela de perfis mostre a matriz completa.
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p where r.key = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r
join public.permissions p on p.key in ('painel.ver', 'equipe.ver')
where r.key = 'supervisor'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, 'painel.ver' from public.roles r where r.key = 'colaborador'
on conflict do nothing;

insert into public.areas (name, description)
select v.name, v.description
from (values
  ('Contábil',             'Equipe que atende escritórios contábeis.'),
  ('Serviços Financeiros', 'Equipe de soluções financeiras, como Domínio Cobranças.')
) as v(name, description)
where not exists (select 1 from public.areas a where lower(a.name) = lower(v.name));

insert into public.levels (name, rank)
select v.name, v.rank
from (values ('Júnior', 1), ('Pleno', 2), ('Sênior', 3)) as v(name, rank)
where not exists (select 1 from public.levels l where lower(l.name) = lower(v.name) or l.rank = v.rank);
