/**
 * O Supabase foi conectado e as tabelas do Kirvra já foram criadas: motoristas, sessoes, alertas, evidencias, operadores e acoes_operador. A partir de agora toda funcionalidade da central deve salvar e ler dados dessas tabelas. Pode começar a construir a central usando esse banco.
 * 
 * IMPORTANTE: os nomes acima representam os domínios funcionais. No banco VYRA2, use exclusivamente os nomes físicos já existentes:
 * motoristas → drivers
 * veículos → vehicles
 * sessões → protection_sessions
 * alertas comuns → alerts
 * alertas da IA e de segurança → security_alerts
 * análises da IA → ai_analysis_events
 * evidências → alert_evidence
 * operadores → central_profiles
 * cargos → central_roles
 * permissões → central_permissions
 * cargos dos operadores → central_user_roles
 * permissões dos cargos → central_role_permissions
 * atribuições e atendimento de alertas → central_alert_assignments
 * ações e auditoria → central_audit_logs
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
