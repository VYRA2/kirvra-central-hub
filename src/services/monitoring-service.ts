/**
 * Monitoramento ao vivo — sessões de proteção reais do VYRA2.
 * Sem dados inventados: sessões sem localização válida não geram marcador.
 */
import { isRecentHeartbeat, type LiveAlert, type LiveSession } from "@/integrations/vyra/live";
import type { RiskLevel } from "@/integrations/vyra/types";
import { fetchLiveContext } from "./vyra-live-service";
import type { DataSource } from "./dashboard-service";

export interface MonitoringFilters {
  search: string;
  risk: RiskLevel | "todos";
  onlyOffline: boolean;
}

export const DEFAULT_MONITORING_FILTERS: MonitoringFilters = {
  search: "",
  risk: "todos",
  onlyOffline: false,
};

export interface MonitoringData {
  source: DataSource;
  updatedAt: string;
  sessions: LiveSession[];
  alerts: LiveAlert[];
}

export async function getMonitoringData(): Promise<MonitoringData> {
  const context = await fetchLiveContext();

  return {
    source: "vyra",
    updatedAt: context.updatedAt,
    sessions: context.sessions
      .filter((session) => session.state !== "encerrada" && !session.endedAt)
      .map((session) => ({
        ...session,
        state: isRecentHeartbeat(session.lastHeartbeatAt) ? session.state : "offline",
      })),
    alerts: context.alerts,
  };
}

export function applyMonitoringFilters(
  sessions: LiveSession[],
  filters: MonitoringFilters,
): LiveSession[] {
  const term = filters.search.trim().toLowerCase();
  return sessions.filter((session) => {
    if (term) {
      const haystack = [session.driverName, session.plate, session.vehicleLabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (filters.risk !== "todos" && session.riskLevel !== filters.risk) {
      return false;
    }
    if (filters.onlyOffline && session.state !== "offline") return false;
    return true;
  });
}

/** Sessões com coordenadas válidas — as únicas que podem virar marcador. */
export function locatableSessions(sessions: LiveSession[]): LiveSession[] {
  return sessions.filter((session) => session.point !== null);
}
