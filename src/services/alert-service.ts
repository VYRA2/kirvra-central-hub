/**
 * Fila de alertas, atendimento e histórico.
 *
 * Regras críticas: a IA nunca decide; toda decisão é humana, auditada e
 * exige confirmação explícita. Enquanto não houver função atômica segura no
 * backend, nenhuma atribuição ou decisão é dada como concluída.
 */
import type {
  Alert,
  AlertAudio,
  AlertEvidence,
  AlertSeverity,
  AlertState,
  AlertTranscript,
  Driver,
  Vehicle,
} from "@/integrations/vyra/types";
import {
  alertAudios,
  alertEvidences,
  alertHistory,
  alerts,
  alertTranscripts,
  findAlert,
  findDriver,
  findVehicle,
} from "@/mocks/kirvra-central";
import type { ServiceResult } from "./auth-service";
import { assertDemoData } from "./mock-guard";

export interface AlertQueueFilters {
  state: AlertState | "todos";
  severity: AlertSeverity | "todos";
  operatorId: string | "todos";
}

export const DEFAULT_QUEUE_FILTERS: AlertQueueFilters = {
  state: "todos",
  severity: "todos",
  operatorId: "todos",
};

export interface AlertRow {
  alert: Alert;
  driverName: string;
  plate: string;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critico: 0,
  suspeito: 1,
  atencao: 2,
};

function decorate(list: Alert[]): AlertRow[] {
  return list.map((alert) => ({
    alert,
    driverName: findDriver(alert.driverId)?.displayName ?? "Motorista",
    plate: findVehicle(alert.vehicleId)?.plate ?? "—",
  }));
}

export async function listAlertQueue(
  filters: AlertQueueFilters,
): Promise<AlertRow[]> {
  assertDemoData();
  return decorate(
    [...alerts]
      .filter((a) => filters.state === "todos" || a.state === filters.state)
      .filter(
        (a) => filters.severity === "todos" || a.severity === filters.severity,
      )
      .filter(
        (a) =>
          filters.operatorId === "todos" ||
          a.assignment.operatorId === filters.operatorId,
      )
      .sort(
        (a, b) =>
          SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
          new Date(a.waitingSince).getTime() -
            new Date(b.waitingSince).getTime(),
      ),
  );
}

export interface HistoryFilters {
  period: "7d" | "30d" | "90d" | "todos";
  outcome: "confirmado" | "falso_positivo" | "encerrado" | "todos";
  page: number;
  pageSize: number;
}

export const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  period: "30d",
  outcome: "todos",
  page: 1,
  pageSize: 10,
};

export interface HistoryPage {
  rows: AlertRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PERIOD_DAYS: Record<HistoryFilters["period"], number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  todos: null,
};

export async function listAlertHistory(
  filters: HistoryFilters,
): Promise<HistoryPage> {
  assertDemoData();
  const days = PERIOD_DAYS[filters.period];
  const cutoff = days ? Date.now() - days * 86_400_000 : null;

  const filtered = alertHistory
    .filter((a) => (cutoff ? new Date(a.detectedAt).getTime() >= cutoff : true))
    .filter(
      (a) =>
        filters.outcome === "todos" || a.decision?.outcome === filters.outcome,
    )
    .sort(
      (a, b) =>
        new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
    );

  const start = (filters.page - 1) * filters.pageSize;
  return {
    rows: decorate(filtered.slice(start, start + filters.pageSize)),
    total: filtered.length,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export interface AlertDetail {
  alert: Alert;
  driver: Driver;
  vehicle: Vehicle | null;
  evidence: AlertEvidence | null;
  audio: AlertAudio | null;
  transcript: AlertTranscript | null;
  readOnly: boolean;
}

export async function getAlertDetail(
  alertId: string,
): Promise<AlertDetail | null> {
  assertDemoData();
  const alert = findAlert(alertId);
  if (!alert) return null;
  const driver = findDriver(alert.driverId);
  if (!driver) return null;
  return {
    alert,
    driver,
    vehicle: findVehicle(alert.vehicleId),
    evidence: alertEvidences.find((e) => e.alertId === alertId) ?? null,
    audio: alertAudios.find((a) => a.alertId === alertId) ?? null,
    transcript: alertTranscripts.find((t) => t.alertId === alertId) ?? null,
    readOnly: Boolean(alert.decision),
  };
}

export function nextUnassignedCritical(): Alert | null {
  assertDemoData();
  return (
    [...alerts]
      .filter((a) => a.severity === "critico" && !a.assignment.operatorId)
      .sort(
        (a, b) =>
          new Date(a.waitingSince).getTime() -
          new Date(b.waitingSince).getTime(),
      )[0] ?? null
  );
}

const PENDING: ServiceResult = {
  status: "pending",
  message:
    "Integração pendente: a operação exige função atômica no Supabase VYRA2 e não foi gravada.",
};

/** Atribuição precisa ser atômica no banco — nunca resolvida no frontend. */
export async function claimAlert(_alertId: string): Promise<ServiceResult> {
  assertDemoData();
  return PENDING;
}

export async function confirmThreat(
  _alertId: string,
  notes: string,
): Promise<ServiceResult> {
  assertDemoData();
  if (!notes.trim())
    return { status: "error", message: "Descreva a confirmação da ameaça." };
  return PENDING;
}

export async function markFalsePositive(
  _alertId: string,
  reason: string,
): Promise<ServiceResult> {
  assertDemoData();
  if (!reason.trim())
    return { status: "error", message: "O motivo é obrigatório." };
  return PENDING;
}

export async function closeAlert(
  _alertId: string,
  outcome: string,
  notes: string,
): Promise<ServiceResult> {
  assertDemoData();
  if (!outcome.trim() || !notes.trim())
    return {
      status: "error",
      message: "Resultado e observação são obrigatórios.",
    };
  return PENDING;
}

export async function startProtocol(_alertId: string): Promise<ServiceResult> {
  assertDemoData();
  return PENDING;
}

export async function addAlertNote(
  _alertId: string,
  note: string,
): Promise<ServiceResult> {
  assertDemoData();
  if (!note.trim())
    return { status: "error", message: "A nota não pode ficar vazia." };
  return PENDING;
}

export async function transferAlert(
  _alertId: string,
  targetOperatorId: string,
): Promise<ServiceResult> {
  assertDemoData();
  if (!targetOperatorId)
    return { status: "error", message: "Selecione o operador de destino." };
  return PENDING;
}

export async function escalateAlert(
  _alertId: string,
  supervisorId: string,
): Promise<ServiceResult> {
  assertDemoData();
  if (!supervisorId)
    return { status: "error", message: "Selecione o supervisor." };
  return PENDING;
}

export async function exportAlertHistory(): Promise<ServiceResult> {
  assertDemoData();
  return {
    status: "pending",
    message:
      "Integração pendente: exportação exige permissões e backend seguro.",
  };
}
