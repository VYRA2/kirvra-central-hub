/**
 * Dados da Central de Comando.
 * Hoje lê do mock centralizado; a assinatura já é assíncrona para trocar
 * por consultas ao Supabase VYRA2 sem reconstruir a página.
 */
import type {
  Alert,
  OperationalMetric,
  ProtectionSession,
  SystemHealth,
} from "@/integrations/vyra/types";
import {
  alerts,
  operationalMetrics,
  sessions,
  systemHealth,
} from "@/mocks/kirvra-central";

export interface CommandOverview {
  metrics: OperationalMetric[];
  priorityAlerts: Alert[];
  liveSessions: ProtectionSession[];
  health: SystemHealth[];
  focusedSessionId: string;
}

const SEVERITY_ORDER = { critico: 0, suspeito: 1, atencao: 2 } as const;

export async function getCommandOverview(): Promise<CommandOverview> {
  const priorityAlerts = [...alerts]
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime(),
    )
    .slice(0, 3);

  return {
    metrics: operationalMetrics,
    priorityAlerts,
    liveSessions: sessions,
    health: systemHealth,
    focusedSessionId: "ses-1042",
  };
}
