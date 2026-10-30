-- =====================================================================
-- Etapa 2 · Carga inicial
-- Trilha "Onboarding Comercial" (antiga página de links) e os 13
-- materiais da pasta "Onbording Comercial" do Google Drive.
-- Idempotente: não duplica se for executada de novo.
-- =====================================================================

do $$
declare
  v_track uuid;
  v_mod uuid;
  v_lr_note constant text := 'Entre com o seu e-mail corporativo. Senha padrão do primeiro acesso: @123456TR';
  v_sgd_note constant text := 'Entre com a sua credencial do SGD.';
  r record;
  v_pos integer;
begin
  if exists (select 1 from public.tracks where lower(name) = 'onboarding comercial') then
    return;
  end if;

  -- Conteúdos externos da trilha -------------------------------------------------
  create temporary table seed_items (
    module_pos integer, item_pos integer, title text, category text, url text, platform text, note text,
    minutes integer, required boolean, library boolean, description text
  ) on commit drop;

  insert into seed_items values
    (1, 1, 'Ted Talk – Técnicas de Vendas', 'Técnicas de vendas',
       'https://dominiosistemas.learning.rocks/contents/1588975?ref=spaces&ref_detail=158263', 'Learning Rocks', v_lr_note, null, true, false,
       'Abordagem comercial antes de estudar os produtos.'),
    (2, 1, 'Itens Gerais do Sistema Domínio', 'Produtos',
       'https://sgd.dominiosistemas.com.br/sgsc/faces/academy-sgd-curso.html?curso=96', 'Academy SGD', v_sgd_note, null, true, false,
       'Visão geral do portfólio Domínio.'),
    (2, 2, 'TR | Honorários', 'Produtos',
       'https://sgd.dominiosistemas.com.br/sgsc/faces/academy-sgd-curso.html?curso=136', 'Academy SGD', v_sgd_note, null, true, false, null),
    (2, 3, 'Trilha de formação Domínio Messenger', 'Produtos',
       'https://sgd.dominiosistemas.com.br/sgsc/faces/academy-sgd-curso.html?curso=138', 'Academy SGD', v_sgd_note, null, true, false, null),
    (2, 4, 'Pré-Work e Treinamento – Domínio Serviços Digitais', 'Produtos',
       'https://dominiosistemas.learning.rocks/spaces/162732#section-458531', 'Learning Rocks', v_lr_note, null, true, false, null),
    (3, 1, 'Workshop – Domínio Folha de Pagamento', 'Workshops',
       'https://dominiosistemas.learning.rocks/spaces/158263#section-385704', 'Learning Rocks', v_lr_note, null, true, false, null),
    (3, 2, 'Workshop – Domínio Escrita Fiscal', 'Workshops',
       'https://dominiosistemas.learning.rocks/spaces/158263#section-385700', 'Learning Rocks', v_lr_note, null, true, false, null),
    (3, 3, 'Workshop – Domínio Contabilidade', 'Workshops',
       'https://dominiosistemas.learning.rocks/spaces/158263#section-385705', 'Learning Rocks', v_lr_note, null, true, false, null),
    (3, 4, 'Workshop – Domínio Honorários', 'Workshops',
       'https://dominiosistemas.learning.rocks/spaces/158263#section-387051', 'Learning Rocks', v_lr_note, null, true, false, null),
    (3, 5, 'Workshop – Domínio Portal do Cliente', 'Workshops',
       'https://dominiosistemas.learning.rocks/spaces/158263#section-387052', 'Learning Rocks', v_lr_note, null, true, false, null),
    -- Materiais de apoio (Google Drive) — opcionais na trilha e na biblioteca
    (4, 1, 'Vídeo Institucional Thomson Reuters', 'Institucional',
       'https://drive.google.com/file/d/1QYgDiEPxX5pJNKQdFVYXCXfRG0B2PaF6/view', 'Google Drive', null, null, false, true,
       'Para entender a empresa e abrir reuniões. Vídeo, 147 MB.'),
    (4, 2, 'Apresentação institucional', 'Institucional',
       'https://drive.google.com/file/d/1_P6glspRDdPZkUJk-TQechbyT9xT38L_/view', 'Google Drive', null, null, false, true, 'PDF, 41 MB.'),
    (4, 3, 'Documento de lançamento dos novos pacotes', 'Novos Pacotes Domínio',
       'https://drive.google.com/file/d/1a0PB9Z0ojEYeNTcWGw2rcZ0LzwPlnowt/view', 'Google Drive', null, null, false, true,
       'Leia antes das apresentações dos novos pacotes.'),
    (4, 4, 'Uso interno – Novos pacotes Domínio', 'Novos Pacotes Domínio',
       'https://drive.google.com/file/d/1z4ToyP6_rATJcryJCfSCcCpsg3yVYsPL/view', 'Google Drive', null, null, false, true,
       'Apresentação de uso interno. Não enviar ao cliente.'),
    (4, 5, 'Demonstração comercial – Novos pacotes', 'Novos Pacotes Domínio',
       'https://drive.google.com/file/d/1smKmyhYeRtMIuhoilkUgwOR1R0ZyzVLI/view', 'Google Drive', null, null, false, true, 'Apresentação para o cliente.'),
    (4, 6, 'Catálogo Empresarial', 'Catálogos',
       'https://drive.google.com/file/d/1xE6NotNYUQJObWYEEIxt6PoAcpB1ijz1/view', 'Google Drive', null, null, false, true, 'PDF para enviar ao cliente.'),
    (4, 7, 'Catálogo Digital', 'Catálogos',
       'https://drive.google.com/file/d/1x6TFT79hzaZz8LniCWvAS4ZRo5xDQqFk/view', 'Google Drive', null, null, false, true, 'PDF para enviar ao cliente.'),
    (4, 8, 'Synergy – Serviços Digitais (versão comercial)', 'Serviços Digitais',
       'https://drive.google.com/file/d/1PXiCQT22UxkW-Q08FymtOvi23oMT5nK3/view', 'Google Drive', null, null, false, true,
       'Apresentação de 287 MB. Prefira abrir no Drive.'),
    (4, 9, 'Apresentação Contabilidade Digital', 'Serviços Digitais',
       'https://drive.google.com/file/d/1KpBhqgh4QXlyDARisD1t-REguKtvDF6y/view', 'Google Drive', null, null, false, true,
       'Apresentação de 186 MB. Prefira abrir no Drive.'),
    (4, 10, 'Institucional Domínio Contabilidade Digital', 'Serviços Digitais',
       'https://drive.google.com/file/d/1wER74j2YsmiX1zBNIwzb0QtrL777KJQs/view', 'Google Drive', null, null, false, true, 'Vídeo, 73 MB.'),
    (4, 11, 'Vídeo publicitário Domínio Cobranças', 'Serviços Digitais',
       'https://drive.google.com/file/d/1FYs2C8m-Qyb-nsyFR5NelN63zSB15Nej/view', 'Google Drive', null, null, false, true,
       'Serviços Financeiros. Vídeo, 142 MB.');

  insert into public.contents (title, description, category, kind, url, external_platform, access_note,
                               estimated_minutes, is_library, status)
  select s.title, s.description, s.category,
         (case when s.title ilike '%vídeo%' or s.title ilike 'institucional domínio%' then 'video' else 'link' end)::public.content_kind,
         s.url, s.platform, s.note, s.minutes, s.library, 'publicado'
  from seed_items s
  where not exists (select 1 from public.contents c where lower(c.title) = lower(s.title));

  -- Trilha -------------------------------------------------------------------
  insert into public.tracks (name, description, objective, audience_note, is_mandatory, is_sequential, status)
  values (
    'Onboarding Comercial',
    'Trilha de capacitação dos vendedores recém-contratados: técnicas de vendas, produtos Domínio e workshops por módulo.',
    'Preparar o vendedor para apresentar o portfólio Domínio com segurança nas primeiras semanas.',
    'Vendedores recém-contratados das áreas Contábil e Serviços Financeiros.',
    true, true, 'rascunho'
  )
  returning id into v_track;

  for r in
    select * from (values
      (1, 'Técnicas de Vendas', 'Comece pela abordagem comercial antes de estudar os produtos.'),
      (2, 'Produtos', 'Visão geral do portfólio Domínio e dos produtos que você vai apresentar.'),
      (3, 'Workshops de produto', 'Aprofundamento em cada módulo do Sistema Domínio.'),
      (4, 'Materiais de apoio', 'Vídeos, catálogos e apresentações para consulta. Opcionais.')
    ) as m(pos, title, description)
  loop
    insert into public.modules (track_id, title, description, position)
    values (v_track, r.title, r.description, r.pos)
    returning id into v_mod;

    insert into public.module_items (module_id, content_id, position, is_required)
    select v_mod, c.id, s.item_pos, s.required
    from seed_items s
    join public.contents c on lower(c.title) = lower(s.title)
    where s.module_pos = r.pos;
  end loop;

  -- Público: áreas Contábil e Serviços Financeiros (trilha e biblioteca)
  insert into public.audience_rules (track_id, area_id)
  select v_track, a.id from public.areas a where a.name in ('Contábil', 'Serviços Financeiros');

  insert into public.audience_rules (content_id, area_id)
  select c.id, a.id
  from public.contents c
  join seed_items s on lower(s.title) = lower(c.title) and s.library
  cross join public.areas a
  where a.name in ('Contábil', 'Serviços Financeiros');

  update public.tracks set status = 'publicado' where id = v_track;
end;
$$;
