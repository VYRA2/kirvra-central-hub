# Substituição da ponte do mapa por MapLibre nativo

## Objetivo
Eliminar a ponte instável entre Leaflet e MapLibre, mantendo o OpenFreeMap e a interface pública atual do mapa.

## Implementação
- Instalar `react-map-gl`.
- Reescrever somente `src/components/kirvra/geo-map.tsx` com `react-map-gl/maplibre`.
- Preservar exatamente `GeoMarker` e as propriedades `markers`, `activeId`, `track` e `onSelect`.
- Manter enquadramento, seleção, trajeto, cores, estado offline e centro padrão em São Paulo.
- Remover de `src/styles.css` apenas a regra temporária de altura do container MapLibre.
- Manter as dependências Leaflet instaladas até confirmar que não há outro uso; como a busca mostrou uso apenas no mapa substituído e no CSS, elas poderão ser removidas junto com o plugin da ponte.

## Validação
- Confirmar compilação sem erros.
- Verificar visualmente que o mapa nativo preenche o painel e carrega ruas do OpenFreeMap.
- Quando houver acesso autenticado, conferir Central de Comando, Sessão protegida e Atendimento do alerta, incluindo marcadores e clique.

## Escopo preservado
Nenhuma tela, consulta, alerta, evidência, regra operacional ou componente consumidor será alterado.
