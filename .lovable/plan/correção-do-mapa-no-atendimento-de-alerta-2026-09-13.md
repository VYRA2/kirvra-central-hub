# Correção do mapa no atendimento de alerta

## Objetivo
Substituir somente o mapa ilustrativo da tela **Atendimento do alerta** pelo mapa geográfico real já usado no restante da Central, exibindo a coordenada exata capturada pelo alerta.

## Alterações
- Adicionar `latitude` e `longitude` ao contrato `Alert`, ambos aceitando ausência de valor.
- Preencher esses campos diretamente a partir de `security_alerts`, sem arredondamento ou transformação.
- Na tela `/alertas/$alertId`, trocar `LiveMapPanel` por `GeoMapPanel`.
- Criar um único marcador quando ambas as coordenadas existirem, usando o alerta, o motorista e a severidade já carregados.
- Recriar a barra inferior através do `overlay`, mantendo o texto e o botão **Abrir sessão** com o mesmo destino atual.
- Preservar a descrição de localização, a consulta existente e todos os demais fluxos da tela.

## Validação
- Confirmar que o projeto compila sem erros.
- Abrir um alerta com coordenadas e verificar mapa real, marcador e botão **Abrir sessão**.
- Confirmar que alertas sem coordenadas continuam exibindo o mapa com o estado vazio já existente.

## Limites
Não alterar `map-panel.tsx`, `geo-map.tsx`, `geo-map-panel.tsx`, consultas, RPCs, evidências, áudio ou outras telas.
