# Correção do redimensionamento do mapa operacional

## Objetivo
Evitar o painel branco na Central de Comando fazendo a camada MapLibre recalcular seu tamanho após a montagem e em redimensionamentos da janela.

## Implementação
- Alterar somente `MapLibreTiles` em `src/components/kirvra/geo-map.tsx`.
- Obter a instância interna com `getMaplibreMap()` e chamar `resize()` no próximo frame.
- Repetir o ajuste quando a janela mudar de tamanho.
- Remover o frame, o listener e a camada na desmontagem.

## Validação
- Confirmar a compilação sem erros.
- Verificar o mapa da Central de Comando vazio e com sessões, além dos mapas de sessão e atendimento de alerta.

## Escopo preservado
Nenhum outro arquivo, estilo, marcador, trajeto, enquadramento ou regra operacional será alterado.
