# Correção da camada visual do mapa

## Objetivo
Substituir apenas os tiles bloqueados do OpenStreetMap pela camada vetorial gratuita do OpenFreeMap, mantendo o Leaflet, os marcadores, trajetos, cliques e enquadramento existentes.

## Implementação
- Instalar `maplibre-gl` e `@maplibre/maplibre-gl-leaflet`.
- Em `geo-map.tsx`, carregar os estilos e o plugin oficial.
- Criar `MapLibreTiles` para anexar e remover a camada `liberty` do OpenFreeMap pelo mapa Leaflet atual.
- Trocar somente o `TileLayer` por `MapLibreTiles` e habilitar a atribuição automática.

## Validação
- Confirmar que o projeto compila sem erros.
- Abrir a Central de Comando e o detalhe de sessão para verificar ruas, bairros, marcadores e enquadramento.

## Escopo preservado
Nenhum outro componente, tela, consulta, alerta, variável de ambiente ou regra operacional será alterado.
