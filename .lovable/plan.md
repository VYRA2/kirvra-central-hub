# Plano de Implementação: KIRVRA CENTRAL — Lote 2

Implementação das telas de **Evidências** (`/evidencias`) e **Auditoria** (`/auditoria`), integradas exclusivamente ao Supabase VYRA2, respeitando permissões, RLS e fidelidade visual.

## 1. Tela de Evidências (`/evidencias`)
Focada em gerir a biblioteca protegida de imagens, áudios e vídeos vinculados aos alertas.

### Detalhes Técnicos
- **Tabela Principal**: `alert_evidence` ( bucket `alert-evidence`).
- **Relacionamentos**: `drivers`, `protection_sessions`, `alerts`, `security_alerts`.
- **Funcionalidades**:
  - Filtros por tipo (frame, clipe), origem (comum vs IA) e período.
  - Grade/Lista com ordenação descendente.
  - Visualizador de detalhes com geração de **URLs assinadas** temporárias.
- **Segurança**: Permissões `evidence.view`, `evidence.image`, `evidence.audio`.

## 2. Tela de Auditoria (`/auditoria`)
Registro imutável de todas as ações críticas da Central.

### Detalhes Técnicos
- **Tabela Principal**: `central_audit_logs`.
- **Relacionamentos**: `central_profiles` (para nome/código do operador).
- **Funcionalidades**:
  - Tabela paginada (25 registros).
  - Filtros por operador, ação, entidade e período.
  - Painel de detalhes exibindo `previous_data` e `next_data` (JSON comparativo).
- **Segurança**: Somente leitura, requer permissão `audit.view`.

## 3. Infraestrutura e Serviços
- **Serviços**:
  - `src/services/evidence-service.ts`: Listagem e geração de URLs assinadas.
  - `src/services/audit-service.ts`: Listagem e busca de logs de auditoria.
- **Componentes**:
  - `EvidenceCard`: Componente para a grade de evidências.
  - `AuditLogTable`: Componente de tabela com paginação.
  - `DataDiff`: Visualizador de diferenças JSON para auditoria.

## 4. Etapas
1. Criar `src/services/evidence-service.ts` e `src/services/audit-service.ts`.
2. Implementar a rota e componente da Tela de Evidências.
3. Implementar a rota e componente da Tela de Auditoria.
4. Refatorar as rotas de Alertas e Sessões para utilizar dados reais do VYRA2 e remover mocks residuais.
5. Verificação final: TypeScript, Lint, Build e testes de permissão.

---
**Nota**: Não haverá criação de tabelas ou migrations neste lote. O modo demonstração será ignorado nestas telas.
