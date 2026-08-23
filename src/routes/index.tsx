/**
 * O Supabase foi conectado e as tabelas do Kirvra já foram criadas: motoristas, sessoes, alertas, evidencias, operadores e acoes_operador. A partir de agora toda funcionalidade da central deve salvar e ler dados dessas tabelas... IMPORTANTE: os nomes acima representam os domínios funcionais. No banco VYRA2, use exclusivamente os nomes físicos já existentes: [lista de mapeamento]
 *
 * Implemente agora somente estas duas telas: /evidencias e /auditoria. Preserve o layout, menu lateral, cores, componentes, tipografia e responsividade já existentes...
 *
 * CORREÇÃO CIRÚRGICA — TELAS EVIDÊNCIAS E AUDITORIA DA CENTRAL KIRVRA...
 *
 * Implemente exclusivamente a tela anexada 11-veiculos.png.
 * 
 * Referência visual obrigatória
 * 
 * A imagem anexada é a fonte visual oficial e soberana desta implementação.
 * 
 * Reproduza com máxima fidelidade:
 * 
 * Estrutura e proporções.
 * 
 * Menu lateral existente.
 * 
 * Cabeçalho.
 * 
 * Títulos, subtítulos, busca, filtro, tabela e botões.
 * 
 * Cores, bordas, espaçamentos, tipografia e alinhamentos.
 * 
 * Estado “Veículos” destacado no menu.
 * 
 * Densidade e largura das colunas.
 * 
 * Não redesenhar, reinterpretar, modernizar ou simplificar a tela.
 * 
 * A estrutura visual deve ser idêntica, mas os registros demonstrativos da imagem não podem ser copiados. Todo conteúdo deverá vir do Supabase VYRA2.
 * 
 * Escopo rigoroso
 * 
 * Trabalhe somente na tela de Veículos e nos arquivos diretamente necessários.
 * 
 * Arquivos esperados:
 * 
 * src/routes/_central.veiculos.tsx
 * 
 * src/services/vehicle-service.ts
 * 
 * Componentes exclusivos da tela, caso realmente necessários.
 * 
 * Reutilize o AppShell, cabeçalho, menu lateral, componentes e tokens visuais existentes.
 * 
 * Não alterar:
 * 
 * Login ou autenticação.
 * 
 * Central de Comando.
 * 
 * Monitoramento.
 * 
 * Alertas.
 * 
 * Motoristas.
 * 
 * Evidências.
 * 
 * Equipe.
 * 
 * Auditoria.
 * 
 * Outras telas.
 * 
 * Schema, migrations, RLS ou policies.
 * 
 * Integração existente com o Supabase VYRA2.
 * 
 * Lovable Cloud.
 * 
 * Configuração do GitHub.
 * 
 * Arquivos sem relação com esta tela.
 * 
 * Não executar formatação em massa.
 * 
 * Segurança e permissão
 * 
 * A rota exige a permissão real:
 * 
 * vehicles.view
 * 
 * Use o padrão de proteção de rota já existente no projeto.
 * 
 * A autorização deve continuar sendo validada pelo Supabase e pelas políticas RLS. Não confiar apenas em ocultação visual.
 * 
 * Não usar:
 * 
 * service_role no frontend.
 * 
 * Dados simulados.
 * 
 * Arrays estáticos.
 * 
 * Mocks.
 * 
 * Fallback fictício.
 * 
 * any ou as any.
 * 
 * Valores copiados da imagem.
 * 
 * Dados reais
 * 
 * Utilize exclusivamente:
 * 
 * vehicles
 * 
 * drivers
 * 
 * protection_sessions
 * 
 * Relacionamentos:
 * 
 * vehicles.driver_id → drivers.id
 * 
 * protection_sessions.vehicle_id → vehicles.id
 * 
 * Campos disponíveis em vehicles:
 * 
 * id
 * 
 * driver_id
 * 
 * plate
 * 
 * brand
 * 
 * model
 * 
 * color
 * 
 * year
 * 
 * renavam
 * 
 * photo_path
 * 
 * crlv_path
 * 
 * owner_type
 * 
 * authorization_confirmed
 * 
 * authorization_confirmed_at
 * 
 * verification_status
 * 
 * created_at
 * 
 * updated_at
 * 
 * Buscar o nome do motorista em drivers.full_name.
 * 
 * Encontrar a sessão mais recente de cada veículo utilizando protection_sessions.started_at.
 * 
 * Interface
 * 
 * Reproduzir exatamente:
 * 
 * Cabeçalho: “Veículos”.
 * 
 * Título: “Veículos cadastrados”.
 * 
 * Subtítulo: “Verificação documental e vínculo com motoristas.”
 * 
 * Botão: “Exportar lista”.
 * 
 * Campo: “Buscar placa, modelo ou motorista”.
 * 
 * Filtro: “Todos os estados”.
 * 
 * Tabela com as colunas:
 * 
 * Veículo
 * 
 * Placa
 * 
 * Motorista
 * 
 * Propriedade
 * 
 * Documento
 * 
 * Última sessão
 * 
 * Ação
 * 
 * Na coluna Veículo:
 * 
 * Primeira linha: marca, modelo e ano.
 * 
 * Segunda linha: cor.
 * 
 * Mapeamento de propriedade:
 * 
 * self → “Próprio”
 * 
 * third_party → “Terceiro”
 * 
 * Ausente ou desconhecido → “Não informado”
 * 
 * Mapeamento visual do documento:
 * 
 * verified → “Verificado”, verde.
 * 
 * pending → “Revisão”, amarelo.
 * 
 * rejected → “Reprovado”, vermelho.
 * 
 * Outros valores → rótulo neutro contendo o valor real.
 * 
 * O filtro deve ser construído a partir dos valores reais de verification_status, sem criar estados fictícios no banco.
 * 
 * A última sessão deve ser apresentada em formato relativo:
 * 
 * “Agora”
 * 
 * “Há X min”
 * 
 * “Há X h”
 * 
 * “Ontem”
 * 
 * Data formatada para sessões antigas
 * 
 * “Nenhuma sessão” quando não existir
 * 
 * Busca e filtros
 * 
 * A busca deve funcionar por:
 * 
 * Placa.
 * 
 * Marca.
 * 
 * Modelo.
 * 
 * Cor.
 * 
 * Nome do motorista.
 * 
 * Requisitos:
 * 
 * Debounce curto.
 * 
 * Busca sem diferença entre maiúsculas e minúsculas.
 * 
 * Preservar filtro de estado durante a busca.
 * 
 * Não carregar registros que o usuário não tenha autorização para visualizar.
 * 
 * Ações
 * 
 * O botão “Abrir” deve abrir modal ou painel lateral com os dados completos reais do veículo.
 * 
 * O botão “Revisar” deve abrir o mesmo painel no contexto documental.
 * 
 * Exibir, quando disponíveis:
 * 
 * Marca.
 * 
 * Modelo.
 * 
 * Ano.
 * 
 * Cor.
 * 
 * Placa.
 * 
 * RENAVAM.
 * 
 * Propriedade.
 * 
 * Motorista.
 * 
 * Estado da verificação.
 * 
 * Confirmação de autorização.
 * 
 * Datas relevantes.
 * 
 * Última sessão.
 * 
 * Não alterar verification_status, pois atualmente não existe policy administrativa segura para essa atualização.
 * 
 * Não apresentar confirmação falsa de revisão.
 * 
 * Quando a alteração não estiver disponível, informar:
 * 
 * “Alteração documental ainda não habilitada para esta conta.”
 * 
 * Exportação
 * 
 * O botão “Exportar lista” deve gerar CSV com os registros reais já autorizados e atualmente filtrados.
 * 
 * Não exportar:
 * 
 * URLs privadas.
 * 
 * Caminhos internos de arquivos.
 * 
 * Tokens.
 * 
 * Informações não exibidas ou não autorizadas.
 * 
 * Estados obrigatórios
 * 
 * Implementar:
 * 
 * Carregamento com skeleton.
 * 
 * Lista vazia.
 * 
 * Busca sem resultados.
 * 
 * Erro de consulta.
 * 
 * Falta de permissão.
 * 
 * Dados parcialmente ausentes.
 * 
 * Nova tentativa de carregamento.
 * 
 * Não usar dados simulados para preencher estados vazios.
 * 
 * Responsividade
 * 
 * A referência principal é desktop.
 * 
 * Em telas menores:
 * 
 * Manter o menu existente.
 * 
 * Permitir rolagem horizontal na tabela.
 * 
 * Reorganizar filtros sem sobreposição.
 * 
 * Preservar as colunas e ações.
 * 
 * Não transformar o desktop em cards ou outro design.
 * 
 * Validação antes de concluir
 * 
 * Comparar visualmente com 11-veiculos.png.
 * 
 * Confirmar que nenhum registro da imagem foi copiado.
 * 
 * Confirmar que não existe mock.
 * 
 * Confirmar uso exclusivo do Supabase VYRA2.
 * 
 * Confirmar permissão vehicles.view.
 * 
 * Confirmar funcionamento da busca e do filtro.
 * 
 * Confirmar abertura dos detalhes.
 * 
 * Confirmar exportação do resultado filtrado.
 * 
 * Verificar sessão válida sem redirecionamento indevido para login.
 * 
 * Executar TypeScript.
 * 
 * Executar lint somente nos arquivos alterados.
 * 
 * Executar build completo.
 * 
 * Não deixar erros ou warnings novos.
 * 
 * Ao finalizar, informe:
 * 
 * Arquivos criados.
 * 
 * Arquivos alterados.
 * 
 * Consultas implementadas.
 * 
 * Resultado do TypeScript, lint e build.
 * 
 * Confirmação de que nenhum mock foi usado.
 * 
 * Confirmação de que o schema não foi alterado.
 * 
 * Limitações que permaneceram.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

import { resolveCentralSession } from "@/services/auth-service";

/**
 * Porta de entrada da Central: nunca renderiza conteúdo.
 * Sessão válida → /central; primeiro acesso pendente → /primeiro-acesso;
 * sem sessão → /login.
 */
export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "KIRVRA Central — Vigilância e Atendimento de Alertas" },
      {
        name: "description",
        content:
          "Central operacional KIRVRA: monitoramento ao vivo, análise humana e atendimento de alertas de segurança do KIRVRA Drive e AI Engine.",
      },
      { property: "og:title", content: "KIRVRA Central" },
      {
        property: "og:description",
        content:
          "Plataforma interna de monitoramento, análise humana e atendimento de alertas de segurança KIRVRA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    const session = await resolveCentralSession();
    if (session?.firstAccessPending) {
      throw redirect({ to: "/primeiro-acesso" });
    }
    if (session) throw redirect({ to: "/central" });
    throw redirect({ to: "/login", search: { redirect: "" } });
  },
});
