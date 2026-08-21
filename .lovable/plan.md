# Plano de construção — Central KIRVRA

## Objetivo
Criar o painel web "Central KIRVRA": uma central operacional com autenticação, dashboard, gestão de chamados/tickets e cadastro de clientes, tudo persistido no banco de dados do próprio projeto (Lovable Cloud/Supabase).

## Premissas adotadas
- Projeto/banco: **KIRVRA atual** (Lovable Cloud já ativo).
- Público: operadores/administradores internos da central.
- Login: email/senha + Google OAuth.
- Idioma da interface: português.
- Estilo: minimal, escuro, com identidade KIRVRA.

## Funcionalidades (MVP)

### 1. Autenticação
- Tela pública `/auth` com login por email/senha e botão Google.
- Rotas protegidas sob `/_authenticated/`.
- Perfil de usuário vinculado à tabela `auth.users` via tabela `profiles`.
- Após login, redirecionamento para `/` (dashboard).

### 2. Banco de dados
Tabelas no schema `public`, com RLS, GRANTs e policies:

- `profiles` — estende `auth.users` (nome, papel, avatar, telefone).
- `clients` — cadastro de clientes atendidos pela central (nome, email, telefone, documento, status).
- `tickets` — chamados/tickets (título, descrição, status, prioridade, cliente, responsável, datas).
- `ticket_comments` — histórico de interações em um ticket.

Roles:
- `admin`: acesso total.
- `agent`: pode criar/editar tickets e clientes, mas não gerenciar usuários.
- `viewer`: somente leitura.

### 3. Layout e navegação
- Sidebar fixa com logo KIRVRA e links: Dashboard, Tickets, Clientes, Sair.
- Topbar com nome do usuário logado e avatar.
- Layout responsivo (menu colapsa em mobile).

### 4. Dashboard (`/`)
- Cards de resumo: total de tickets, tickets abertos, tickets urgentes, total de clientes.
- Lista dos tickets mais recentes.
- Gráfico simples de tickets por status.

### 5. Módulo de Tickets (`/tickets`)
- Lista de tickets com filtros (status, prioridade, responsável, cliente).
- Botão "Novo ticket".
- Página de detalhes `/tickets/$ticketId` com:
  - Dados do ticket (editáveis conforme papel).
  - Histórico de comentários.
  - Ações: alterar status/prioridade/responsável.

### 6. Módulo de Clientes (`/clients`)
- Lista de clientes com busca.
- Botão "Novo cliente".
- Página de detalhes `/clients/$clientId` com dados e histórico de tickets do cliente.

### 7. Seed de demonstração
- Inserir usuários de teste (apenas em dev, via migration seed).
- Inserir clientes e tickets de exemplo para o painel já nascer populado.

## Estrutura de arquivos prevista
```text
src/
  routes/
    __root.tsx              # layout raiz + head + auth state listener
    index.tsx               # dashboard
    auth.tsx                # tela de login
    _authenticated/
      route.tsx             # layout protegido (sidebar + topbar)
      tickets.tsx           # lista de tickets
      tickets.$ticketId.tsx # detalhes do ticket
      clients.tsx           # lista de clientes
      clients.$clientId.tsx # detalhes do cliente
  lib/
    auth.functions.ts       # server fns de auth/perfil
    tickets.functions.ts    # server fns de tickets
    clients.functions.ts    # server fns de clientes
    dashboard.functions.ts  # server fns de métricas
  components/
    ui/                     # componentes shadcn
    layout/                 # sidebar, topbar, app-shell
    tickets/                # tabela/filtros de tickets
    clients/                # tabela/filtros de clientes
supabase/
  migrations/
    0001_initial_schema.sql # cria tabelas, grants, RLS, policies, seed
```

## Tecnologias e padrões
- TanStack Start v1 + React 19 + TypeScript.
- Tailwind CSS v4 com tokens do tema do projeto.
- Supabase via Lovable Cloud (cliente browser + server functions).
- `createServerFn` para toda a lógica de backend.
- Rotas protegidas sob `/_authenticated/` com `ssr: false`.
- Zod para validação de inputs nas server functions.
- React Query (`useSuspenseQuery`) para carregamento de dados.

## Critérios de aceitação
- Usuário consegue fazer login e acessar `/`.
- Dashboard mostra métricas reais do banco.
- É possível criar, listar e editar tickets e clientes.
- Dados são isolados por tenant/RLS; usuários não-admin não acessam o que não devem.
- A build passa sem erros e o preview reflete as mudanças.

## Próximos passos após aprovação
1. Criar migration inicial do banco (tabelas + RLS + seed).
2. Configurar Google OAuth.
3. Implementar tela de login e layout protegido.
4. Implementar dashboard, tickets e clientes.
5. Verificar build e preview.
