# Plano — Assistente Claude para análise de alertas na KIRVRA Central

## Objetivo
Adicionar à KIRVRA Central um assistente de IA baseado no Claude (Anthropic) para auxiliar operadores na análise e tomada de decisão sobre alertas de segurança, mantendo a chave da API no servidor e a UI dentro do desenho visual já aprovado.

## Escopo escolhido
Como o pedido foi "conectar com o claude", a integração será feita diretamente com a API Anthropic. A funcionalidade inicial será um painel de assistente na tela de detalhe do alerta (`/alertas/$alertId`), capaz de:
- Resumir o contexto do alerta (dados da sessão, motorista, veículo, evidências).
- Sugerir ações e protocolos com base no tipo de ameaça.
- Responder a perguntas livres do operador sobre o alerta.

## Alterações planejadas

1. **Backend — integração segura com a API Anthropic**
   - Adicionar a dependência `@anthropic-ai/sdk`.
   - Criar `src/services/claude-assistant.functions.ts` com uma `createServerFn` `analyzeAlertWithClaude`.
   - A função receberá `{ alertId, question, context }`, lerá `process.env['ANTHROPIC_API_KEY']` dentro do handler e chamará a API Anthropic Messages.
   - Construir um prompt de sistema enxuto que posicione o modelo como assistente de segurança da KIRVRA, com regras de não inventar dados e não sugerir ações fora dos protocolos da central.
   - Limitar tokens de saída e habilitar streaming opcional para respostas longas.
   - Tratar erros da Anthropic (401, 429, 5xx, etc.) e retornar mensagens amigáveis para a UI.

2. **Frontend — painel de assistente na tela de alerta**
   - Adicionar um painel lateral ou seção expansível em `src/routes/_central.alertas.$alertId.tsx` com:
     - Botão "Analisar com Claude" que envia o contexto do alerta.
     - Campo de pergunta livre.
     - Área de resposta com markdown simples.
     - Estados de carregamento e erro.
   - Usar `useServerFn` para chamar a server function.
   - Preservar o layout e a paleta Midnight Indigo + Neon Mint já existentes.

3. **Configuração de secrets**
   - Adicionar `ANTHROPIC_API_KEY` como secret do projeto via ferramenta de secrets.
   - Garantir que a chave nunca apareça no bundle do cliente.

4. **Validação**
   - Executar `typecheck` e `build` após as alterações.
   - Testar o fluxo no preview com uma pergunta simples e verificar se a resposta é exibida.
   - Verificar logs para garantir que a chave não vazou.

## Arquivos prováveis
- `package.json`
- `src/services/claude-assistant.functions.ts`
- `src/routes/_central.alertas.$alertId.tsx`
- `src/components/kirvra/alert-assistant-panel.tsx` (novo componente)
- `src/components/kirvra/primitives.tsx` (se precisar de novos primitivos visuais)

## Fora do escopo
- Criação de novas tabelas ou migrations.
- Alteração de RLS, policies ou grants.
- Integração com outros modelos (OpenAI, Gemini) — exceto se a chave Anthropic não estiver disponível, caso em que se propõe fallback para Lovable AI Gateway.
- Publicação automática.
- Modificações em outras telas além da tela de detalhe do alerta.
