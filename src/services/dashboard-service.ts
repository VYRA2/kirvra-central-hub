/**
 * Central de Comando — dados reais do VYRA2.
 *
 * Nenhum número é inventado: cada indicador é contado a partir das tabelas
 * existentes (protection_sessions, security_alerts). Quando um dado não existe
 * no esquema, o cartão mostra estado vazio.
 */
import {
  isHandlingAlert,
  isOpenAlert,
  isRecentHeartbeat,
  type LiveAlert,
  type LiveSession,
} from "@/integrations/vyra/live";
import { fetchLiveContext, VyraDataError } from "./vyra-live-service";

export type DataSource = "vyra" | "demo";

export interface CommandMetric {
  id: string;
  label: string;
  /** `null` quando o esquema atual não permite calcular o valor. */
  value: number | null;
  hint: string;
}

export interface RecentEvent {
  id: string;
  label: string;
  detail: string;
  at: string | null;
  tone: "critical" | "warning" | "neutral";
}

export interface CommandOverview {
  source: DataSource;
  updatedAt: string;
  metrics: CommandMetric[];
  sessions: LiveSession[];
  priorityAlerts: LiveAlert[];
  recentEvents: RecentEvent[];
  protectedDrivers: Array<{
    sessionId: string;
    name: string | null;
    plate: string | null;
    lastHeartbeatAt: string | null;
    risk: LiveSession["riskLevel"];
  }>;
}

const SEVERITY_WEIGHT: Record<string, number> = {
  critico: 0,
  suspeito: 1,
  atencao: 2,
};

function buildOverview(
  source: DataSource,
  context: { sessions: LiveSession[]; alerts: LiveAlert[]; updatedAt: string },
): CommandOverview {
  const activeSessions = context.sessions.filter(
    (session) =>
      session.state === "ativa" && !session.endedAt && isRecentHeartbeat(session.lastHeartbeatAt),
  );
  const openAlerts = context.alerts.filter(isOpenAlert);
  const handlingAlerts = context.alerts.filter(isHandlingAlert);
  const criticalAlerts = context.alerts.filter((alert) => alert.severity === "critico");

  const priorityAlerts = [...openAlerts, ...handlingAlerts]
    .sort((a, b) => {
      const severity =
        (SEVERITY_WEIGHT[a.severity ?? ""] ?? 3) - (SEVERITY_WEIGHT[b.severity ?? ""] ?? 3);
      if (severity !== 0) return severity;
      return new Date(a.detectedAt ?? 0).getTime() - new Date(b.detectedAt ?? 0).getTime();
    })
    .slice(0, 5);

  const withHeartbeat = activeSessions.filter((session) => session.lastHeartbeatAt !== null).length;

  return {
    source,
    updatedAt: context.updatedAt,
    metrics: [
      {
        id: "sessoes",
        label: "Sessões protegidas",
        value: activeSessions.length,
        hint: `${withHeartbeat} com heartbeat registrado`,
      },
      {
        id: "novos",
        label: "Alertas novos",
        value: openAlerts.length,
        hint: `${openAlerts.filter((a) => a.severity === "critico").length} críticos aguardando`,
      },
      {
        id: "atendimento",
        label: "Em atendimento",
        value: handlingAlerts.length,
        hint: "Atribuições ativas na Central",
      },
      {
        id: "criticos",
        label: "Alertas críticos",
        value: criticalAlerts.length,
        hint: "Severidade crítica no período aberto",
      },
    ],
    sessions: activeSessions,
    priorityAlerts,
    recentEvents: context.alerts
      .slice()
      .sort((a, b) => new Date(b.detectedAt ?? 0).getTime() - new Date(a.detectedAt ?? 0).getTime())
      .slice(0, 6)
      .map((alert) => ({
        id: alert.id,
        label: alert.threatType ?? "Alerta registrado",
        detail: [alert.driverName, alert.locationLabel].filter(Boolean).join(" · "),
        at: alert.detectedAt,
        tone:
          alert.severity === "critico"
            ? "critical"
            : alert.severity === "suspeito" || alert.severity === "atencao"
              ? "warning"
              : "neutral",
      })),
    protectedDrivers: activeSessions.slice(0, 8).map((session) => ({
      sessionId: session.id,
      name: session.driverName,
      plate: session.plate,
      lastHeartbeatAt: session.lastHeartbeatAt,
      risk: session.riskLevel,
    })),
  };
}

export async function getCommandOverview(): Promise<CommandOverview> {
  const context = await fetchLiveContext();
  return buildOverview("vyra", context);
}

export function describeDataError(error: unknown): string {
  if (error instanceof VyraDataError) return error.message;
  return "Não foi possível carregar os dados operacionais.";
}
