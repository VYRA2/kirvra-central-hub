/**
 * Monitoramento ao vivo. Filtros preparados para consulta server-side e
 * assinatura de Realtime por canal (ainda não ligada a tabelas inventadas).
 */
import type { ProtectionSession, RiskLevel } from "@/integrations/vyra/types";
import { drivers, sessions, vehicles } from "@/mocks/kirvra-central";

export interface MonitoringFilters {
  search: string;
  risk: RiskLevel | "todos";
  operatorId: string | "todos";
  onlyOffline: boolean;
}

export interface MonitoringRow {
  session: ProtectionSession;
  driverName: string;
  plate: string;
}

export const DEFAULT_MONITORING_FILTERS: MonitoringFilters = {
  search: "",
  risk: "todos",
  operatorId: "todos",
  onlyOffline: false,
};

export async function listLiveSessions(
  filters: MonitoringFilters,
): Promise<MonitoringRow[]> {
  const term = filters.search.trim().toLowerCase();

  return sessions
    .map((session) => {
      const driver = drivers.find((d) => d.id === session.driverId);
      const vehicle = vehicles.find((v) => v.id === session.vehicleId);
      return {
        session,
        driverName: driver?.displayName ?? "Motorista",
        plate: vehicle?.plate ?? "—",
      };
    })
    .filter((row) => {
      if (
        term &&
        !row.driverName.toLowerCase().includes(term) &&
        !row.plate.toLowerCase().includes(term)
      ) {
        return false;
      }
      if (filters.risk !== "todos" && row.session.riskLevel !== filters.risk) {
        return false;
      }
      if (
        filters.operatorId !== "todos" &&
        row.session.assignedOperatorId !== filters.operatorId
      ) {
        return false;
      }
      if (filters.onlyOffline && row.session.state !== "offline") return false;
      return true;
    });
}

export type MonitoringEvent =
  | { type: "session_started"; sessionId: string }
  | { type: "heartbeat"; sessionId: string }
  | { type: "location"; sessionId: string }
  | { type: "sensors"; sessionId: string }
  | { type: "alert_created"; alertId: string }
  | { type: "alert_state"; alertId: string }
  | { type: "session_ended"; sessionId: string };

export interface RealtimeHandle {
  status: "pendente" | "conectado" | "desconectado";
  unsubscribe: () => void;
}

/**
 * Assinatura de Realtime. Enquanto o schema do VYRA2 não for inventariado,
 * retorna estado "pendente" — sem canais inventados e sem eventos falsos.
 */
export function subscribeMonitoring(
  _onEvent: (event: MonitoringEvent) => void,
): RealtimeHandle {
  return {
    status: "pendente",
    unsubscribe: () => {},
  };
}
