# Onboarding Implantta · Etapas 1 e 2

Aplicação Next.js + Supabase da plataforma corporativa de onboarding da Implantta.
Esta entrega cobre a **Etapa 1** do plano aprovado: login, perfis e permissões,
colaboradores, áreas, cargos, níveis e auditoria. As demais etapas (trilhas,
avaliações, competências, PDI, comunicação, gamificação, IA, inteligência e
identidade visual) serão construídas sobre esta base.

## O que funciona

| Módulo | O que faz |
| --- | --- |
| Login | E-mail e senha, recuperação de senha por e-mail, convite por e-mail para criar a senha, login com Google opcional e restrito ao domínio. Sem cadastro aberto. |
| Proteção de rotas | Todo o site exige login. Cada página confere a permissão no servidor e o banco confere de novo (RLS). |
| Perfis de acesso | Administrador, Supervisor e Colaborador de fábrica, mais perfis criados pelo administrador com permissões escolhidas em tela. Os menus aparecem conforme as permissões. |
| Colaboradores | Cadastro com nome, e-mail, área, cargo, nível, supervisor, perfil, admissão, início do onboarding e status. Convite automático, reenvio de convite, edição, desativação e reativação. Filtros por nome, área, cargo, nível, status, supervisor, perfil e período de admissão. |
| Áreas, cargos e níveis | Cadastro, edição, desativação e exclusão (bloqueada quando há vínculos). Cargo pertence a uma área e define os níveis em que pode ser exercido. Níveis têm hierarquia reordenável. Inicia com as áreas Contábil e Serviços Financeiros e os níveis Júnior, Pleno e Sênior. |
| Painel | Colaborador vê o próprio cadastro. Supervisor vê os números da equipe. Quem vê todos vê os números gerais e quem está sem cargo ou nível. |
| Meu perfil | Dados do cadastro, troca do próprio nome e da senha. |
| Auditoria | Toda criação, alteração e exclusão em colaboradores, estrutura e perfis fica registrada com autor, data e campos alterados. O registro não pode ser editado nem apagado pela aplicação. |

### Regras de segurança garantidas pelo banco

Estas regras valem mesmo que alguém chame a API diretamente, sem passar pelas telas:

- Colaborador lê só o próprio cadastro e o do seu supervisor.
- Supervisor lê só a própria equipe.
- Usuário desativado perde todo o acesso no próximo carregamento de página.
- Ninguém altera o próprio perfil de acesso nem desativa a própria conta.
- Só administradores criam outro administrador ou concedem a gestão de perfis.
- A plataforma nunca fica sem um administrador ativo.
- Cargo precisa ser da área do colaborador, e o nível precisa estar liberado para o cargo.
- Nada é excluído quando está em uso; o caminho é desativar.

## Etapa 2 · Gestão de aprendizagem

| Módulo | O que faz |
| --- | --- |
| Conteúdos | Texto (Markdown com pré-visualização), link externo com instruções de acesso, vídeo (YouTube, Vimeo e Google Drive aparecem dentro da plataforma) e arquivo enviado (até 50 MB no plano Free). Categoria, objetivo, tempo estimado, responsável e status (rascunho, publicado, arquivado). |
| Biblioteca | Conteúdos marcados como biblioteca aparecem em **Materiais** para o público definido (área, cargo e nível). |
| Trilhas | Módulos e conteúdos em ordem, obrigatórios ou opcionais, nível recomendado, prazo em dias, sequência obrigatória e público-alvo. Publicar, despublicar e arquivar. |
| Matrículas | Trilhas obrigatórias matriculam automaticamente quem é do público, inclusive quem entra depois. Matrícula manual com prazo, inscrição própria em trilhas opcionais, remoção só antes do início. |
| Estudo | Minhas trilhas com progresso e prazo, etapas liberadas em sequência (opcionais sempre liberados), leitor de cada formato, conclusão confirmada ou declarada (cursos externos), navegação anterior/próximo. |
| Tempo de estudo | Tempo com a página aberta e tempo ativo (página visível e interação no último minuto) separados. O banco limita o que o navegador informa ao tempo real decorrido. |
| Acompanhamento | Painel com matrículas, concluídas e em atraso; página de matrículas por trilha com progresso, tempo ativo e prazo; seção "Trilhas e estudo" no cadastro de cada colaborador. Supervisor vê só a equipe. |

A carga inicial cria a trilha **Onboarding Comercial** (a antiga página de links) com os 10 cursos externos como etapas obrigatórias e os 11 materiais do Drive como opcionais e na biblioteca, para as áreas Contábil e Serviços Financeiros.

Novas permissões: `trilhas.gerenciar`, `conteudos.gerenciar` e `progresso.ver`.

## Estrutura

```
supabase/migrations/   Banco: tabelas, funções, gatilhos, RLS e dados iniciais
src/app/               Páginas (App Router). (app)/ = área logada
src/lib/               Login, permissões, consultas, validação e mensagens de erro
src/components/        Componentes de interface
scripts/criar-admin.ts Cria o primeiro administrador
tests/db/              Testes das regras do banco em um Postgres descartável
tests/unit/            Testes de validação e de menus
tests/e2e/             Teste ponta a ponta dos fluxos no navegador
```

## Como colocar no ar

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) na região São Paulo (`sa-east-1`).
2. Aplique as migrações, na ordem dos nomes dos arquivos:
   - pela CLI: `npx supabase link --project-ref SEU_REF` e depois `npx supabase db push`; ou
   - pelo SQL Editor: cole e execute cada arquivo de `supabase/migrations/` na ordem.
3. Em **Authentication › Sign In / Providers**, desligue **Allow new users to sign up**. O acesso passa a ser só por convite.
4. Em **Authentication › URL Configuration**:
   - **Site URL**: o endereço final da aplicação, ex.: `https://onboarding.implantta.com.br`.
   - **Redirect URLs**: `https://onboarding.implantta.com.br/**`.
5. Em **Authentication › Emails › SMTP Settings**, configure o envio pelo provedor da empresa. Sem SMTP próprio, o Supabase limita o envio a poucos e-mails por hora e os convites param de chegar.
6. Em **Authentication › Emails › Templates**, troque o link de dois modelos:

   **Invite user** (assunto sugerido: *Seu acesso à plataforma de onboarding*):
   ```html
   <h2>Bem-vindo(a) à plataforma de onboarding</h2>
   <p>Você foi cadastrado(a) na plataforma de onboarding e desenvolvimento da Implantta.</p>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/definir-senha">Criar minha senha</a></p>
   <p>O link vale por 24 horas. Se expirar, peça um novo ao seu gestor.</p>
   ```

   **Reset password** (assunto sugerido: *Crie uma nova senha*):
   ```html
   <h2>Nova senha</h2>
   <p>Recebemos um pedido para criar uma nova senha.</p>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/definir-senha">Criar nova senha</a></p>
   <p>Se não foi você, ignore este e-mail.</p>
   ```

### 2. Vercel

1. Suba este projeto para um repositório no GitHub e importe-o na Vercel.
2. Em **Settings › Environment Variables**, cadastre as variáveis de `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase › Project Settings › API)
   - `SUPABASE_SERVICE_ROLE_KEY` (mesma tela; **secreta**, só no servidor)
   - `NEXT_PUBLIC_SITE_URL` (o mesmo endereço do Site URL)
   - `NEXT_PUBLIC_GOOGLE_DOMAIN` (opcional): só aceita contas Google desse domínio, ex.: `implantta.com.br`. Vazio aceita qualquer conta Google, inclusive @gmail.com
3. Faça o deploy.

### 3. Primeiro administrador

No seu computador, com as variáveis em um arquivo `.env.local`:

```bash
npm install
node --env-file=.env.local node_modules/.bin/tsx scripts/criar-admin.ts seu.email@implantta.com.br "Seu Nome"
```

O script libera o acesso para esse e-mail (sem senha e sem e-mail de convite). A pessoa entra com a conta Google dele. A partir daí, todo o cadastro é feito pela tela **Colaboradores**.

### 4. Login com Google (obrigatório: é a única forma de entrar)

1. No Google Cloud Console, crie um cliente OAuth do tipo *Aplicativo da Web* com o URI de redirecionamento `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
2. No Supabase, em **Authentication › Sign In / Providers › Google**, ative e informe o Client ID e o Client Secret.
3. Em **Authentication › Sign In / Providers**, desligue **Allow new users to sign up**: só entra quem foi cadastrado na plataforma.
4. Em **Authentication › URL Configuration**, inclua `https://SEU-DOMINIO/auth/callback` nas Redirect URLs.

Como funciona: ao cadastrar um colaborador, a plataforma libera o login para aquele e-mail. No primeiro acesso com Google, o Supabase associa a conta Google a esse login (mesmo e-mail). Conta sem cadastro, desativada ou de outro domínio (se `NEXT_PUBLIC_GOOGLE_DOMAIN` estiver definido) é desconectada; conta criada sem cadastro é apagada.

## Rodar localmente

```bash
cp .env.example .env.local   # preencha com as chaves de um projeto Supabase de desenvolvimento
npm install
npm run dev                  # http://localhost:3000
```

## Testes

```bash
npm run typecheck
npm test                     # testes de validação e menus
TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm test   # inclui os 45 testes das regras do banco
```

Os testes de banco criam um banco temporário, aplicam todas as migrações e conferem cada regra de acesso. Precisam de um Postgres 15 ou mais novo onde o usuário possa criar bancos.

`tests/e2e/` tem o teste ponta a ponta usado na validação. Ele percorre 28 fluxos no navegador: convite, cadastros, permissões, desativação, recuperação de senha, celular e tema escuro. Veja `tests/e2e/README.md`.

## Decisões e limites desta etapa

- **Equipes:** a equipe de um supervisor é definida pelo campo *Supervisor* de cada colaborador. Uma tabela de equipes separada só será criada se aparecer a necessidade de equipes com mais de um supervisor.
- **Novas permissões:** cada etapa seguinte acrescenta as próprias permissões (ex.: `trilhas.gerenciar`). Elas aparecem automaticamente na tela de perfis.
- **Tema:** claro e escuro seguem o sistema do usuário. A troca manual e a personalização de cores e logos são da Etapa 9.
- **Último acesso:** gravado no máximo a cada 5 minutos. O histórico completo de acessos e o tempo de estudo são da Etapa 2.
