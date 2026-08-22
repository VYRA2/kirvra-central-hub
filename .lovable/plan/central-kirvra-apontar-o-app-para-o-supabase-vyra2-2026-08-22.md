# Central KIRVRA — apontar o app para o Supabase VYRA2

## Decisão confirmada
- Projeto Lovable: **d421d4cf-b1ae-44cf-8278-8d7e4eea97ed** (mantido, sem troca).
- Repositório GitHub: **VYRA2/kirvra-central-hub** (mantido).
- Banco de dados usado pelo app: **VYRA2's Project** — `hwpansazevjwzdcmhssc`
  (`https://hwpansazevjwzdcmhssc.supabase.co`).
- Nenhum projeto Lovable, repositório ou banco novo será criado.

## Limitação importante
O Lovable Cloud continua ativado neste projeto e não pode ser removido. Ele
não será usado: o app passará a falar exclusivamente com o Supabase VYRA2
através de um cliente próprio. Consequências práticas:

- Migrations, RLS, policies e configurações de auth do VYRA2 são aplicadas por
  você no painel Supabase — eu escrevo o SQL pronto para colar.
- O login dos usuários passa a ser o do VYRA2.
- Os arquivos gerados do Cloud (`src/integrations/supabase/*`) permanecem no
  repositório, mas o código da aplicação não os importa.

## O que falta para começar
A **publishable/anon key** do projeto VYRA2 (Supabase → Project Settings →
API Keys). Sem ela o app não consegue autenticar contra o VYRA2. Ela será
salva como segredo do projeto, não escrita no código.

## Etapas

### 1. Camada de conexão VYRA2
- `src/integrations/vyra/client.ts` — cliente browser (URL + publishable key),
  com sessão persistida, tipado por um `Database` local.
- `src/integrations/vyra/auth-middleware.ts` — middleware de server function
  que valida o bearer token contra o VYRA2 e injeta `supabase`/`userId`.
- Variáveis: `VITE_VYRA_SUPABASE_URL`, `VITE_VYRA_SUPABASE_PUBLISHABLE_KEY`
  (browser) e equivalentes server-side em segredos.
- `src/start.ts` recebe o attacher de bearer do VYRA2 no `functionMiddleware`.

### 2. SQL para o VYRA2 (você aplica no painel)
Um arquivo `supabase/vyra/0001_kirvra_schema.sql` versionado no repositório,
com tabelas, GRANTs, RLS e policies:

- `profiles` — dados do usuário (nome, avatar, telefone).
- `user_roles` + enum `app_role` (`admin`, `agent`, `viewer`) e função
  `has_role()` security definer.
- `clients` — clientes atendidos pela central.
- `tickets` — chamados (título, descrição, status, prioridade, cliente,
  responsável, datas).
- `ticket_comments` — histórico de interações.
- Trigger de `updated_at` e trigger que cria `profiles` no primeiro login.
- Seed opcional de clientes/tickets de exemplo.

### 3. Autenticação
- Rota pública `/auth`: login e cadastro por email/senha contra o VYRA2.
- Rotas protegidas sob `src/routes/_authenticated/` com gate `ssr: false`.
- Google OAuth fica de fora nesta etapa: o broker do Lovable só funciona com o
  Cloud. Se quiser Google, configura-se o provider direto no painel do VYRA2 e
  eu ligo o `signInWithOAuth` padrão depois.

### 4. Painel
- Shell com sidebar (Dashboard, Tickets, Clientes, Sair) e topbar com usuário.
- `/` — dashboard: cards de resumo (tickets totais, abertos, urgentes,
  clientes) e lista de tickets recentes.
- `/tickets` — lista com filtros por status, prioridade e responsável;
  `/tickets/$ticketId` com edição e comentários.
- `/clients` — lista com busca; `/clients/$clientId` com dados e histórico.
- Identidade KIRVRA: tema escuro minimalista via tokens em `src/styles.css`.

### 5. Verificação
- Build limpa e preview funcional.
- Login real contra o VYRA2, leitura e escrita de tickets/clientes com RLS
  ativa.

## Detalhes técnicos
- TanStack Start v1, React 19, TypeScript, Tailwind v4.
- Toda leitura/escrita sensível via `createServerFn` com o middleware VYRA2.
- Zod para validação de input; React Query para carregamento de dados.
- Nenhum uso de service role no cliente; chaves apenas em segredos.

## Próximo passo imediato após aprovação
Pedir a publishable key do VYRA2 pelo formulário seguro de segredos e então
implementar a camada de conexão.
