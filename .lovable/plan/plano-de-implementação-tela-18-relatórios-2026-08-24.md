# Plano de Implementação — Tela 18: Relatórios

Implementar a tela `/relatorios` com fidelidade visual à imagem anexada `18-relatorios.png`, utilizando exclusivamente dados reais do Supabase VYRA2.

## 1. Camada de dados

Criar:

`src/services/report-service.ts`

O serviço deve consultar apenas as tabelas reais:

- `protection_sessions`
- `alerts`
- `security_alerts`
- `central_alert_assignments`
- `central_audit_logs`

Não usar a tabela inexistente `alert_assignments`.

Implementar:

- `getReportData(filters)`
- total de sessões no período;
- comparação com o período anterior de mesma duração;
- total de alertas críticos;
- tempo médio de resposta;
- percentual de falsos positivos;
- alertas agrupados por dia;
- ameaças agrupadas por categoria;
- qualidade das análises de IA.

Não criar tabelas, migrations, policies ou dados fictícios.

## 2. Cálculos

### Sessões no período

Consultar `protection_sessions.started_at` dentro do intervalo selecionado.

Comparar com o período anterior de mesma duração.

### Alertas críticos

A tabela `alerts` não possui coluna de severidade.

Utilizar:

`security_alerts.risk_level`

para identificar alertas críticos.

Usar `security_alerts.detected_at` como data da detecção.

### Resposta média

Calcular o intervalo entre:

- `security_alerts.detected_at` ou `alerts.created_at`;
- `central_alert_assignments.accepted_at`.

Utilizar somente atribuições com `accepted_at` preenchido.

Se não houver dados suficientes, mostrar `00:00` ou “Dados insuficientes”. Não estimar valores.

### Falsos positivos

Utilizar somente alertas efetivamente revisados, identificados por:

- `security_alerts.reviewed_at`;
- `security_alerts.reviewed_by`;
- valor real existente em `security_alerts.status`.

Antes de implementar, conferir no schema e no código atual qual valor representa falso positivo. Não assumir automaticamente `falso_positivo`.

Cálculo:

alertas revisados classificados como falso positivo ÷ total de alertas revisados × 100.

### Ameaças por categoria

Usar:

- `security_alerts.threat_type`
- `security_alerts.threat_class`

Mapear para:

- Possível arma/assalto
- Violência corporal
- Áudio/palavra de risco
- Outros sinais

Valores desconhecidos devem entrar em “Outros sinais”.

### Qualidade da IA

Usar somente registros revisados em `security_alerts`.

Cálculo:

análises confirmadas por revisão humana ÷ total de análises de IA revisadas × 100.

Antes de calcular, conferir os valores reais de `status` que representam confirmação humana.

Alertas pendentes não entram no denominador.

## 3. Interface

Criar:

`src/routes/_central.relatorios.tsx`

A imagem `18-relatorios.png` é a fonte visual soberana. Reproduzir fielmente:

- título `Indicadores operacionais`;
- subtítulo;
- botão `Selecionar período`;
- botão `Exportar PDF`;
- quatro cartões superiores;
- painel `Alertas por dia`;
- painel `Ameaças por categoria`;
- seção `Qualidade da IA`;
- cores, bordas, espaçamentos e tipografia.

Preservar o App Shell existente, sem duplicar menu ou cabeçalho.

## 4. Seleção de período

Implementar:

- últimos 7 dias;
- últimos 30 dias;
- últimos 90 dias;
- período personalizado.

Padrão: últimos 7 dias.

Ao alterar o período, atualizar todos os indicadores, gráfico, categorias, qualidade da IA e PDF.

Usar o fuso:

`America/Sao_Paulo`

## 5. Gráfico

Usar `recharts`, já compatível com o projeto.

O gráfico `Alertas por dia` deve:

- agrupar alertas por dia;
- incluir dias sem alertas com valor zero;
- usar a cor verde KIRVRA;
- apresentar tooltip com data e quantidade;
- ser responsivo;
- não utilizar valores fixos da imagem.

## 6. Exportação PDF

Criar:

`src/lib/pdf-exporter.ts`

Usar `jspdf` e `jspdf-autotable` para gerar um PDF real contendo:

- identidade KIRVRA;
- título `Relatório Operacional`;
- período selecionado;
- data e hora da geração;
- operador autenticado;
- indicadores;
- alertas por dia;
- ameaças por categoria;
- qualidade da IA.

Nome do arquivo:

`kirvra-relatorio-operacional-AAAA-MM-DD.pdf`

O PDF deve refletir os mesmos dados filtrados exibidos na tela.

## 7. Segurança

Proteger a rota com:

`reports.view`

Usar exclusivamente:

`getVyraClient()`

Não utilizar:

- Lovable Cloud como banco;
- `src/integrations/supabase/*`;
- `service_role`;
- mocks;
- valores fictícios.

Respeitar integralmente o RLS do VYRA2.

## 8. Estados da tela

Implementar:

- skeleton de carregamento;
- período sem dados;
- erro de consulta;
- acesso negado;
- sessão expirada;
- exportação em andamento;
- falha na geração do PDF.

Quando não houver dados, manter indicadores zerados ou mostrar “Dados insuficientes”.

## 9. Responsividade

No desktop, reproduzir exatamente `18-relatorios.png`.

Em telas menores:

- empilhar cartões;
- empilhar gráfico e categorias;
- preservar legibilidade;
- impedir cortes horizontais;
- manter o App Shell responsivo existente.

## 10. Verificação

Antes de concluir:

1. Rodar build.
2. Rodar typecheck.
3. Rodar lint nos arquivos alterados.
4. Testar acesso com `reports.view`.
5. Testar bloqueio sem `reports.view`.
6. Testar todos os períodos.
7. Testar o download do PDF.
8. Confirmar ausência de mocks.
9. Confirmar que nenhum número da imagem foi fixado.
10. Confirmar uso exclusivo do cliente VYRA2.

Ao finalizar, informar:

- arquivos criados e alterados;
- tabelas e campos utilizados;
- fórmulas aplicadas;
- resultado do build, typecheck e lint;
- métricas indisponíveis por ausência de dados;
- confirmação de que banco, migrations e RLS não foram alterados.