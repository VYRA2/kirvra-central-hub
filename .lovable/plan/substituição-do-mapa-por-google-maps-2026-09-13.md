# Substituição do mapa por Google Maps

## Implementação
- Instalar `@vis.gl/react-google-maps`.
- Reescrever somente `src/components/kirvra/geo-map.tsx`, removendo MapLibre desse arquivo.
- Preservar exatamente `GeoMarker` e as propriedades `markers`, `activeId`, `track` e `onSelect`.
- Manter centro padrão em São Paulo, enquadramento, seleção, trajeto e cores por risco.
- Usar a chave Google Maps já cadastrada no projeto sem gravar seu valor no código.
- Não alterar `geo-map-panel.tsx`, telas consumidoras ou regras operacionais.

## Validação
- Confirmar compilação sem erros.
- Verificar que não restaram imports MapLibre/Leaflet em `geo-map.tsx`.
- Conferir o carregamento do Google Maps, marcadores e trajeto na prévia disponível; telas autenticadas serão verificadas se houver sessão acessível.
