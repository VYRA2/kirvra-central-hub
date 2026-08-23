# KIRVRA CENTRAL — Conectar a tela de Escalas ao Supabase VYRA2

Este plano detalha a transição da tela de Escalas de um estado de "integração pendente" para uma operação baseada em dados reais do Supabase VYRA2, incluindo suporte a Realtime.

## Mudanças Técnicas

### 1. Atualização dos Tipos de Dados
- Sincronizar `src/integrations/vyra/types.ts` com as tabelas reais: `central_regions`, `central_shifts`, `central_shift_assignments`, `central_operator_presence`, `central_region_assignments`, `central_shift_handovers`.

### 2. Refatoração do Serviço de Escalas (`src/services/schedule-service.ts`)
- Remover mocks e o estado `integrationPending`.
- Implementar funções de busca para cada domínio funcional (turnos, escalas, presença, regiões).
- Definir constante `HEARTBEAT_TIMEOUT_MINUTES = 5` para determinar status offline.
- Criar `subscribeToScheduleChanges` para gerenciar assinaturas Realtime de forma centralizada.
- Implementar agregação de métricas baseada estritamente em dados do banco.

### 3. Ajustes na Interface (`src/routes/_central.escalas.tsx`)
- Integrar a assinatura Realtime no hook `useQuery` ou via `useEffect`.
- Atualizar renderização para refletir dados reais e lidar com estados vazios (zero nos indicadores).
- Manter botões administrativos desabilitados com notificação de "Edge Function pendente".

## Detalhes de Segurança e RLS
- Utilizar exclusivamente o cliente Supabase VYRA2.
- Respeitar a permissão `schedules.manage` já implementada.
- Sem inserção ou alteração direta de dados pelo frontend (somente leitura).

## Arquivos Afetados
- `src/integrations/vyra/types.ts`: Adição das definições das tabelas de escalas.
- `src/services/schedule-service.ts`: Implementação da lógica real e Realtime.
- `src/routes/_central.escalas.tsx`: Conexão da UI aos dados vivos.
