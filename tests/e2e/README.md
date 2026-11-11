# Teste ponta a ponta

`fluxos.mjs` abre o navegador (Playwright + Chromium) e percorre 28 fluxos da Etapa 1
contra uma aplicação rodando em `http://localhost:3000` ligada a um Supabase local.

Para não depender de Docker, a validação usou os próprios serviços do Supabase rodando
direto na máquina:

| Serviço | Origem | Porta |
| --- | --- | --- |
| Postgres 16 | sistema | 54329 |
| Supabase Auth (GoTrue) v2.177.0 | binário do GitHub `supabase/auth` | 9999 |
| PostgREST v12.2.3 | binário do GitHub `PostgREST/postgrest` | 3001 |
| `stack-local/gateway.mjs` | este repositório | 54321 (API) e 2525 (SMTP) |

O gateway imita o roteamento do Supabase (`/auth/v1`, `/rest/v1`), serve os modelos de
e-mail de convite e recuperação (os mesmos do README principal) e guarda os e-mails
enviados para o teste ler os links.

## Como rodar

1. Gere as chaves: `node stack-local/keys.mjs > keys.env`.
2. Copie `auth.env.example` e `postgrest.conf.example`, troque `__JWT_SECRET__` pelo valor de `keys.env`.
3. Ajuste os caminhos no início de `stack-local/reset.sh` e rode-o. Ele recria o banco,
   aplica as migrações, sobe Auth, PostgREST e a aplicação, e cria o primeiro administrador.
4. `node fluxos.mjs` (com `SERVICE_KEY` de `keys.env` no ambiente).

Com o Supabase CLI (`npx supabase start`, que usa Docker) o teste também funciona.
Nesse caso, troque a leitura de e-mails em `lastLinkFor` pela API do Mailpit do CLI.

## Isolamento entre roteiros

Cada roteiro parte de um banco recém-criado:
- `fluxos.mjs` espera o banco vazio, logo após o `reset.sh`.
- Os demais (`acompanhamento`, `avaliacoes`, `certificados`, `comunicacao`, `emails`, `checklist`, `pesquisa`...) rodam depois de `fluxos-etapa2.mjs`.

Não encadeie vários roteiros no mesmo banco: eles criam trilhas, avisos e cadastros com nomes fixos e um atrapalha o outro. Isso dá erros como nome de trilha repetido ou "resolved to 3 elements" no sininho.

`emails.mjs` precisa do `fake-resend.mjs` rodando na porta 54398.
