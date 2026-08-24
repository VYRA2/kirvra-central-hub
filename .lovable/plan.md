# Plano — Mapas persistentes e monitoramento Realtime da KIRVRA Central

## Objetivo
Corrigir estruturalmente `/central` e `/monitoramento` preservando integralmente o desenho atual, usando somente dados reais do cliente VYRA2 e mantendo o OpenStreetMap montado mesmo quando nenhuma sessão possui coordenadas.

## Diagnóstico auditado
- Rotas: `src/routes/_central.central.tsx` e `src/routes/_central.monitoramento.tsx`.
- Wrapper compartilhado: `src/components/kirvra/geo-map-panel.tsx`.
- Mapa Leaflet/OpenStreetMap: `src/components/kirvra/geo-map.tsx`.
- Dados: `src/services/vyra-live-service.ts`, `src/services/monitoring-service.ts`, `src/services/dashboard-service.ts` e normalizadores em `src/integrations/vyra/live.ts`.
- Realtime: `src/services/realtime-service.ts` e `src/hooks/use-central-realtime.ts`.
- Problema confirmado: `GeoMapPanel` retorna apenas estado vazio quando `markers.length === 0`, impedindo a montagem do `MapContainer`; portanto o centro São Paulo existente no mapa nunca é utilizado nessa situação.
- A origem operacional atual é `security_alerts`; as rotas já invalidam queries após eventos do canal compartilhado.

## Alterações planejadas
1. **Mapa sempre montado**
   - Remover o retorno antecipado de estado vazio em `geo-map-panel.tsx`.
   - Renderizar sempre `Frame`, `ClientOnly`, `Suspense` e `GeoMap`, inclusive com lista de marcadores vazia.
   - Exibir “Nenhuma sessão com localização válida no momento” como overlay discreto somente quando não houver marcadores, sem ocultar controles ou tiles.
   - Manter centro inicial `[-23.5505, -46.6333]` e zoom `11` no mapa vazio.
   - Garantir coordenadas somente quando finitas e dentro dos limites válidos; preservar sessões sem GPS na lista.

2. **Resiliência visual e ciclo do Leaflet**
   - Adicionar invalidação de tamanho após montagem e redimensionamento, sem recriar o mapa.
   - Preservar ajuste de bounds/centralização para marcadores reais e seleção de sessão.
   - Evitar marcadores fictícios, coordenadas inventadas ou substituição do mapa por erro/vazio.

3. **Dados e estados operacionais**
   - Revisar filtros e normalização para manter sessões ativas sem localização, com heartbeat e estado de conexão reais.
   - Manter a regra de motorista conectado: sessão ativa, não encerrada e heartbeat válido nos 5 minutos definidos pelo projeto.
   - Confirmar que Central e Monitoramento calculam métricas a partir de `protection_sessions` e `security_alerts`, sem mocks, arrays estáticos ou fallback demonstrativo.

4. **Realtime único**
   - Preservar o canal compartilhado e deduplicado existente.
   - Assinar eventos em `protection_sessions`, `security_alerts`, `drivers`, `vehicles` e `central_operator_presence` conforme disponibilidade já integrada.
   - Refinar mapeamento dos estados `SUBSCRIBED`, conectando, reconectando, erro/fechado e cleanup, sem polling agressivo nem canais duplicados.
   - Invalidar as queries sem reload para que lista, métricas, alertas e marcadores respondam às mudanças.

5. **Validação**
   - Executar build, typecheck e lint direcionado aos arquivos alterados.
   - Inspecionar o código para confirmar ausência de mocks nas rotas/serviços envolvidos e ausência de `service_role`/segredos no bundle cliente.
   - Verificar no preview que o mapa continua visível sem coordenadas, com overlay e centro em São Paulo; que uma atualização real altera a lista/mapa sem recarga; e que alertas reais continuam alimentando Central, Monitoramento, Alertas e notificações.
   - Documentar qualquer bloqueio verdadeiro de schema/RLS sem criar ou alterar migrations, tabelas, policies, grants ou secrets.

## Arquivos prováveis
- `src/components/kirvra/geo-map-panel.tsx`
- `src/components/kirvra/geo-map.tsx`
- `src/services/realtime-service.ts`
- `src/hooks/use-central-realtime.ts`
- `src/services/vyra-live-service.ts`
- `src/services/monitoring-service.ts`
- `src/services/dashboard-service.ts`
- `src/routes/_central.central.tsx`
- `src/routes/_central.monitoramento.tsx`

## Fora do escopo
- Redesign, troca de identidade visual ou alteração de textos não relacionada ao funcionamento.
- Criação/aplicação de migrations, alteração de schema, RLS, policies, grants ou secrets.
- Troca do cliente, URL ou chave VYRA2.
- Publicação automática.
