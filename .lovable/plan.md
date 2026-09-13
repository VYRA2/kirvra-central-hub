# Correção urgente do carregamento do Google Maps

## Implementação
- Alterar somente `src/components/kirvra/geo-map.tsx`.
- Remover `createServerFn`, `process.env`, estado local e chamada assíncrona usados para obter a chave.
- Usar diretamente no cliente a chave pública do Google Maps configurada para navegador e protegida por domínio.
- Preservar integralmente `GeoMarker`, `pinIcon`, `ViewController`, `TrackPolyline`, `GoogleMap` e todas as propriedades públicas de `GeoMap`.

## Validação
- Confirmar compilação sem erros e ausência de `createServerFn`, `process.env` e `useState` no arquivo.
- Verificar que `/central` não cai mais na página de erro e que o mapa carrega ruas reais.
- Conferir também os mapas de Sessão protegida e Atendimento do alerta quando houver sessão autenticada disponível.

## Escopo preservado
- Não alterar `geo-map-panel.tsx`, telas consumidoras ou qualquer outra funcionalidade da Central.
