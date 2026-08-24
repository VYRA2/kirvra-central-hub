# Plano de Implementação — Tela de Veículos (KIRVRA Central)

Implementação da tela de Veículos (11-veiculos.png) com integração real ao Supabase VYRA2, respeitando fidelidade visual absoluta e requisitos de segurança.

## Objetivos
- Criar `src/services/vehicle-service.ts` para operações de CRUD e busca.
- Implementar `src/routes/_central.veiculos.tsx` com listagem, filtros, busca e exportação.
- Garantir permissão `vehicles.view` e RLS.

## Etapas Técnicas

### 1. Camada de Dados (`src/services/vehicle-service.ts`)
- `listVehicles`: Consulta com join em `drivers` e `protection_sessions`.
- `exportVehicles`: Geração de CSV dos dados filtrados.
- `getVehicleById`: Detalhes completos para o modal.
- Tipagem rigorosa usando `Database` de `src/integrations/vyra/types`.

### 2. Interface (`src/routes/_central.veiculos.tsx`)
- **Layout**: Idêntico a `11-veiculos.png`.
- **Componentes**: 
  - `VehicleTable`: Colunas específicas (Veículo, Placa, Motorista, Propriedade, Documento, Última sessão, Ação).
  - `VehicleFilters`: Busca textual e seletor de estado.
  - `VehicleDetailsDrawer`: Painel lateral para "Abrir" e "Revisar".
- **Estados**: Skeleton loader, empty state, erro de permissão.

### 3. Integração e Segurança
- Validação de `vehicles.view` no `beforeLoad` da rota.
- Mapeamento de enums: `owner_type` e `verification_status`.
- Formatação de data relativa para a última sessão.

## Detalhes Visuais (Midnight Indigo + Neon Mint)
- Tabela de alta densidade.
- Badges de status coloridos (Verificado, Revisão, Reprovado).
- Botões de ação alinhados à direita.
