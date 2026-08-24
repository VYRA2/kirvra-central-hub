# Plano — Central e Monitoramento em tempo real

## Objetivo
Tornar `/central` e `/monitoramento` operacionais com dados reais do cliente VYRA2, sem redesenhar as telas, sem migrations/schema changes e sem alterar a identidade visual existente.

## Escopo técnico
1. **Auditar e consolidar a fonte de dados real**
   - Revisar `vyra-live-service`, `dashboard-service` e `monitoring-service` contra os tipos físicos já presentes.
   - Remover o caminho de demonstração dessas duas rotas e evitar arrays estáticos, marcadores fictícios e métricas estimadas.
   - Definir uma única regra de sessão conectada: estado ativo, heartbeat dentro do limite operacional vigente e sessão não encerrada.
   - Preservar sessões reais sem coordenadas na lista e retornar somente pontos válidos ao mapa.

2. **Criar uma camada Realtime única e reutilizável**
   - Evoluir `realtime-service`/`use-central-realtime` para um canal compartilhado entre as telas.
   - Assinar INSERT/UPDATE/DELETE de `protection_sessions`, `security_alerts` (fonte já usada pela fila), `drivers`, `vehicles` e `central_operator_presence` quando disponível.
   - Deduplicar referências, reportar estados reais `conectando`, `conectado`, `reconectando` e `erro`, e remover o canal no cleanup.
   - Invalidar apenas as queries afetadas, sem reload e sem polling agressivo.

3. **Atualizar `/monitoramento`**
   - Alimentar lista, filtros, status de conexão, heartbeat, risco e mapa exclusivamente pelas queries reais.
   - Atualizar marcadores quando coordenadas mudarem e centralizar no marcador ao selecionar uma pessoa.
   - Manter estados vazios e de erro explícitos, sem substituir dados ausentes por mocks.
   - Adicionar/usar o indicador funcional de motoristas conectados e operadores online sem alterar layout ou identidade visual.

4. **Atualizar `/central`**
   - Recalcular os quatro cartões a partir de sessões e alertas reais: protegidas, novos, em atendimento e críticos.
   - Propagar imediatamente alterações de alertas/sessões para cartões, mapa, eventos, lista de motoristas e notificações.
   - Manter os links existentes para `/monitoramento` e `/alertas`.

5. **Validação**
   - Executar build, TypeScript e lint.
   - Fazer inspeção de código para confirmar ausência de mocks nas rotas/serviços alterados e ausência de segredos no bundle cliente.
   - Validar no preview que uma alteração Realtime em `protection_sessions` atualiza lista/mapa sem recarregar e que um novo `security_alerts` aparece na Central, Monitoramento, Alertas e contador.
   - Documentar qualquer bloqueio real de schema/policy e não aplicar SQL, migrations ou secrets.

## Arquivos prováveis
- `src/services/realtime-service.ts`
- `src/hooks/use-central-realtime.ts`
- `src/services/vyra-live-service.ts`
- `src/services/dashboard-service.ts`
- `src/services/monitoring-service.ts`
- `src/routes/_central.central.tsx`
- `src/routes/_central.monitoramento.tsx`
- possivelmente `src/components/kirvra/app-shell.tsx` e tipos/normalizadores relacionados, somente se necessário para propagar as atualizações.

## Fora do escopo
- Redesign ou alteração visual das telas.
- Criação/aplicação de migrations, alteração de RLS/grants/schema ou secrets.
- Troca do cliente, URL ou chave VYRA2.
- Publicação automática.
