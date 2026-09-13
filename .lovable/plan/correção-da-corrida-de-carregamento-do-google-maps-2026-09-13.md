# Correção da corrida de carregamento do Google Maps

## Objetivo
Impedir que os marcadores acessem `google.maps` antes de a API do Google Maps estar pronta.

## Implementação
- Alterar somente `src/components/kirvra/geo-map.tsx`.
- Importar `useApiIsLoaded` de `@vis.gl/react-google-maps`.
- Consultar o estado de carregamento no componente interno `GoogleMap`.
- Renderizar os marcadores somente quando a API estiver carregada.
- Preservar integralmente `pinIcon`, `ViewController`, `TrackPolyline`, `GeoMarker`, a chave e todas as propriedades públicas.

## Validação
- Confirmar compilação sem erros e conferir o diff restrito ao import e à renderização dos marcadores.
- Recarregar `/central` várias vezes e verificar ausência de `ReferenceError: google is not defined` quando houver acesso autenticado.
- Conferir também Sessão protegida e Atendimento do alerta quando houver sessão autenticada disponível.

## Escopo preservado
- Não alterar `geo-map-panel.tsx`, telas consumidoras ou qualquer outra funcionalidade da Central.
