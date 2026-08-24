# Plano de Implementação — Tela 18: Relatórios

Implementação da tela de Relatórios operacionais com fidelidade visual à imagem `18-relatorios.png`, conectada ao Supabase VYRA2.

## Ações Propostas

### 1. Camada de Dados e Serviços
- Criar `src/services/report-service.ts`:
  - Interface `ReportMetrics` para os indicadores superiores.
  - Interface `DailyAlertData` para o gráfico de barras.
  - Interface `ThreatCategoryData` para o painel de categorias.
  - Função `getReportData(filters)`:
    - `protection_sessions`: total de sessões no período.
    - `alerts`: contagem por severidade ('critico'), status ('falso_positivo'), tipo de ameaça e data.
    - `alert_assignments`/`central_audit_logs`: cálculo do tempo médio de resposta (atendimento).
    - `security_alerts`: qualidade da IA (confirmações vs total revisado).
  - Implementar fórmulas de comparação temporal (período anterior).

### 2. Exportação de PDF
- Integrar biblioteca `jspdf` e `jspdf-autotable`.
- Criar utilitário `src/lib/pdf-exporter.ts` para gerar o arquivo fiel à identidade KIRVRA.

### 3. Interface Visual (UI)
- Criar `src/routes/_central.relatorios.tsx`:
  - **Header**: Título, subtítulo e botões de ação ("Selecionar período", "Exportar PDF").
  - **Indicadores**: Grid com os 4 cartões (Sessões, Alertas Críticos, Resposta Média, Falsos Positivos).
  - **Gráfico**: Implementar o gráfico de barras "Alertas por dia" usando `recharts` ou `nivo`, respeitando a cor verde KIRVRA.
  - **Painéis Laterais**: "Ameaças por categoria" (lista com porcentagem) e "Qualidade da IA".
  - **Filtros**: Modal/Popover para seleção de datas (7d, 30d, 90d, custom).

### 4. Segurança e Integração
- Proteger rota com `RequirePermission` (permissão `reports.view`).
- Garantir uso exclusivo do cliente Supabase VYRA2.
- Implementar skeletons e estados de erro/vazio.

## Detalhes Técnicos
- **Timezone**: America/Sao_Paulo forzado em todas as consultas e formatações.
- **Gráficos**: Uso de bibliotecas compatíveis com o projeto para garantir performance e responsividade.
- **PDF**: Geração client-side para evitar sobrecarga no backend e garantir privacidade dos dados.

## Verificação
- Build e Typecheck.
- Teste de permissões.
- Validação do download do PDF.
- Verificação da ausência de dados fictícios.
