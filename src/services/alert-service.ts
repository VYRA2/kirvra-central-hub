import { getVyraClient } from "@/integrations/vyra/client";
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
import type { ServiceResult } from "./auth-service";
import { getDriverDetail } from "./driver-service";

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

export interface CentralOperatorOption {
  id: string;
  fullName: string;
}

type SecurityAlertDb = {
  id: string;
  session_id: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  source: string;
  threat_type: string;
  threat_class: string | null;
  confidence: number | string | null;
  risk_score: number;
  risk_level: string;
  frame_path: string | null;
  audio_path: string | null;
  video_path: string | null;
  latitude: number | null;
  longitude: number | null;
  detected_at: string;
  status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  notes: string | null;
};

type AssignmentDb = {
  id: string;
  security_alert_id: string | null;
  operator_id: string;
  status: string;
  assigned_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  notes: string | null;
};

type DriverDb = { id: string; full_name: string | null };
type VehicleDb = {
  id: string;
  driver_id: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
  color: string | null;
  verification_status: string;
};
type ProfileDb = { id: string; full_name: string };
type EvidenceDb = {
  id: string;
  security_alert_id: string | null;
  evidence_type: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  metadata: Record<string, unknown> | null;
  captured_at: string;
};

function client() {
  const value = getVyraClient();
  if (!value) throw new Error("Supabase VYRA2 não configurado.");
  return value;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { critico: 0, suspeito: 1, atencao: 2 };

function severity(value: string): AlertSeverity {
  if (["critical", "critico", "crítico"].includes(value.toLowerCase())) return "critico";
  if (["high", "suspicious", "suspeito"].includes(value.toLowerCase())) return "suspeito";
  return "atencao";
}

function state(value: string, assignment?: AssignmentDb): AlertState {
  const normalized = value.toLowerCase();
  if (normalized === "confirmed") return "confirmado";
  if (normalized === "false_positive") return "falso_positivo";
  if (normalized === "closed") return "encerrado";
  if (["reviewing", "in_review"].includes(normalized)) return "em_analise";
  if (assignment) return assignment.accepted_at ? "em_analise" : "assumido";
  return "novo";
}

function outcome(value: string): "confirmado" | "falso_positivo" | "encerrado" | null {
  if (value === "confirmed") return "confirmado";
  if (value === "false_positive") return "falso_positivo";
  if (value === "closed") return "encerrado";
  return null;
}

function confidence(value: number | string | null) {
  const number = Number(value ?? 0);
  return number > 1 ? number / 100 : Math.max(0, number);
}

function protocol(row: SecurityAlertDb) {
  const day = row.detected_at.slice(0, 10).replaceAll("-", "");
  return `KRV-${day}-${row.id.slice(0, 6).toUpperCase()}`;
}

function latestAssignment(alertId: string, assignments: AssignmentDb[]) {
  return assignments
    .filter((item) => item.security_alert_id === alertId && item.status !== "cancelled")
    .sort((a, b) => b.assigned_at.localeCompare(a.assigned_at))[0];
}

function mapAlert(
  row: SecurityAlertDb,
  assignments: AssignmentDb[],
  profiles: Map<string, string>,
): Alert {
  const assignment = latestAssignment(row.id, assignments);
  const decisionOutcome = outcome(row.status);
  const location =
    row.latitude !== null && row.longitude !== null
      ? `${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`
      : "Localização não informada";

  return {
    id: row.id,
    protocol: protocol(row),
    driverId: row.driver_id ?? "",
    vehicleId: row.vehicle_id ?? "",
    sessionId: row.session_id ?? "",
    threatType: row.threat_type || row.threat_class || "Sinal de risco",
    confidence: confidence(row.confidence),
    severity: severity(row.risk_level),
    state: state(row.status, assignment),
    riskScore: row.risk_score,
    locationLabel: location,
    detectedAt: row.detected_at,
    waitingSince: row.detected_at,
    assignment: {
      alertId: row.id,
      operatorId: assignment?.operator_id ?? null,
      operatorName: assignment ? (profiles.get(assignment.operator_id) ?? "Operador") : null,
      assignedAt: assignment?.assigned_at ?? null,
    },
    decision:
      decisionOutcome && row.reviewed_at && row.reviewed_by
        ? {
            alertId: row.id,
            outcome: decisionOutcome,
            reason: row.notes ?? "Decisão registrada pelo operador",
            notes: row.notes ?? "",
            decidedBy: profiles.get(row.reviewed_by) ?? row.reviewed_by,
            decidedAt: row.reviewed_at,
          }
        : null,
    handlingStartedAt: assignment?.accepted_at ?? assignment?.assigned_at ?? null,
  };
}

async function loadContext() {
  const db = client();
  const [alertsResult, assignmentsResult, driversResult, vehiclesResult, profilesResult] =
    await Promise.all([
      db.from("security_alerts").select("*").order("detected_at", { ascending: false }).limit(1000),
      db
        .from("central_alert_assignments")
        .select("*")
        .order("assigned_at", { ascending: false })
        .limit(2000),
      db.from("drivers").select("id,full_name").limit(2000),
      db
        .from("vehicles")
        .select("id,driver_id,brand,model,year,plate,color,verification_status")
        .limit(2000),
      db.from("central_profiles").select("id,full_name").limit(500),
    ]);
  const error =
    alertsResult.error ??
    assignmentsResult.error ??
    driversResult.error ??
    vehiclesResult.error ??
    profilesResult.error;
  if (error) throw error;
  return {
    alerts: (alertsResult.data ?? []) as SecurityAlertDb[],
    assignments: (assignmentsResult.data ?? []) as AssignmentDb[],
    drivers: (driversResult.data ?? []) as DriverDb[],
    vehicles: (vehiclesResult.data ?? []) as VehicleDb[],
    profiles: (profilesResult.data ?? []) as ProfileDb[],
  };
}

function decorate(
  context: Awaited<ReturnType<typeof loadContext>>,
  rows: SecurityAlertDb[],
): AlertRow[] {
  const profileNames = new Map(context.profiles.map((profile) => [profile.id, profile.full_name]));
  const driverNames = new Map(
    context.drivers.map((driver) => [driver.id, driver.full_name ?? "Motorista"]),
  );
  const vehiclePlates = new Map(
    context.vehicles.map((vehicle) => [vehicle.id, vehicle.plate ?? "Sem placa"]),
  );
  return rows.map((row) => ({
    alert: mapAlert(row, context.assignments, profileNames),
    driverName: row.driver_id
      ? (driverNames.get(row.driver_id) ?? "Motorista")
      : "Motorista não identificado",
    plate: row.vehicle_id ? (vehiclePlates.get(row.vehicle_id) ?? "Sem placa") : "—",
  }));
}

export async function listCentralOperators(): Promise<CentralOperatorOption[]> {
  const { data, error } = await client()
    .from("central_profiles")
    .select("id,full_name")
    .in("status", ["ativo", "active"])
    .order("full_name");
  if (error) throw error;
  return ((data ?? []) as ProfileDb[]).map((profile) => ({
    id: profile.id,
    fullName: profile.full_name,
  }));
}

export async function listAlertQueue(filters: AlertQueueFilters): Promise<AlertRow[]> {
  const context = await loadContext();
  return decorate(context, context.alerts)
    .filter(({ alert }) => !alert.decision)
    .filter(({ alert }) => filters.state === "todos" || alert.state === filters.state)
    .filter(({ alert }) => filters.severity === "todos" || alert.severity === filters.severity)
    .filter(
      ({ alert }) =>
        filters.operatorId === "todos" || alert.assignment.operatorId === filters.operatorId,
    )
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.alert.severity] - SEVERITY_ORDER[b.alert.severity] ||
        a.alert.detectedAt.localeCompare(b.alert.detectedAt),
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

export async function listAlertHistory(filters: HistoryFilters): Promise<HistoryPage> {
  const context = await loadContext();
  const days = filters.period === "todos" ? null : Number(filters.period.slice(0, -1));
  const cutoff = days ? Date.now() - days * 86_400_000 : null;
  const rows = decorate(context, context.alerts)
    .filter(({ alert }) => Boolean(alert.decision))
    .filter(({ alert }) => (cutoff ? new Date(alert.detectedAt).getTime() >= cutoff : true))
    .filter(
      ({ alert }) => filters.outcome === "todos" || alert.decision?.outcome === filters.outcome,
    )
    .sort((a, b) => b.alert.detectedAt.localeCompare(a.alert.detectedAt));
  const start = (filters.page - 1) * filters.pageSize;
  return {
    rows: rows.slice(start, start + filters.pageSize),
    total: rows.length,
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

async function signedUrl(evidence: EvidenceDb) {
  const { data } = await client()
    .storage.from(evidence.storage_bucket)
    .createSignedUrl(evidence.storage_path, 300);
  return data?.signedUrl ?? null;
}

export async function getAlertDetail(alertId: string): Promise<AlertDetail | null> {
  const context = await loadContext();
  const row = context.alerts.find((alert) => alert.id === alertId);
  if (!row?.driver_id) return null;
  const detail = await getDriverDetail(row.driver_id);
  if (!detail) return null;
  const profiles = new Map(context.profiles.map((profile) => [profile.id, profile.full_name]));
  const alert = mapAlert(row, context.assignments, profiles);
  const vehicle = detail.vehicles.find((item) => item.id === row.vehicle_id) ?? null;
  const { data: evidenceRows, error } = await client()
    .from("alert_evidence")
    .select(
      "id,security_alert_id,evidence_type,storage_bucket,storage_path,mime_type,metadata,captured_at",
    )
    .eq("security_alert_id", alertId)
    .order("captured_at", { ascending: false });
  if (error) throw error;
  const rows = (evidenceRows ?? []) as EvidenceDb[];
  const visual = rows.find(
    (item) => item.mime_type?.startsWith("image/") || item.mime_type?.startsWith("video/"),
  );
  const audioRow = rows.find((item) => item.mime_type?.startsWith("audio/"));
  const metadata = (visual?.metadata ?? audioRow?.metadata ?? {}) as Record<string, unknown>;
  const transcriptText = typeof metadata["transcript"] === "string" ? metadata["transcript"] : null;
  const riskWords = Array.isArray(metadata["risk_words"])
    ? metadata["risk_words"].filter((word): word is string => typeof word === "string")
    : [];
  return {
    alert,
    driver: detail.driver,
    vehicle,
    evidence: visual
      ? {
          id: visual.id,
          alertId,
          kind: visual.mime_type?.startsWith("video/") ? "clipe" : "frame",
          cameraLabel:
            typeof metadata["camera_label"] === "string"
              ? metadata["camera_label"]
              : "Câmera do veículo",
          capturedAt: visual.captured_at,
          confidence: alert.confidence,
          boundingBoxLabel:
            typeof metadata["bounding_box_label"] === "string"
              ? metadata["bounding_box_label"]
              : null,
          signedUrl: await signedUrl(visual),
        }
      : null,
    audio: audioRow
      ? {
          id: audioRow.id,
          alertId,
          durationSeconds:
            typeof metadata["duration_seconds"] === "number" ? metadata["duration_seconds"] : 0,
          waveform: Array.isArray(metadata["waveform"])
            ? metadata["waveform"].filter((value): value is number => typeof value === "number")
            : [],
          signedUrl: await signedUrl(audioRow),
        }
      : null,
    transcript: transcriptText
      ? { id: `transcript-${alertId}`, alertId, text: transcriptText, riskWords }
      : null,
    readOnly: Boolean(alert.decision),
  };
}

export async function nextUnassignedCritical(): Promise<Alert | null> {
  const rows = await listAlertQueue({ state: "todos", severity: "critico", operatorId: "todos" });
  return rows.find(({ alert }) => !alert.assignment.operatorId)?.alert ?? null;
}

async function rpc(name: string, args: Record<string, unknown>): Promise<ServiceResult> {
  const { error } = await client().rpc(name, args);
  if (error) return { status: "error", message: `Operação não concluída: ${error.message}` };
  return { status: "ok" };
}

export async function claimAlert(alertId: string) {
  return rpc("central_claim_security_alert", { p_alert_id: alertId });
}
export async function confirmThreat(alertId: string, notes: string) {
  if (!notes.trim())
    return { status: "error", message: "Descreva a confirmação da ameaça." } as ServiceResult;
  return rpc("central_decide_security_alert", {
    p_alert_id: alertId,
    p_outcome: "confirmed",
    p_notes: notes.trim(),
  });
}
export async function markFalsePositive(alertId: string, reason: string) {
  if (!reason.trim())
    return { status: "error", message: "O motivo é obrigatório." } as ServiceResult;
  return rpc("central_decide_security_alert", {
    p_alert_id: alertId,
    p_outcome: "false_positive",
    p_notes: reason.trim(),
  });
}
export async function closeAlert(alertId: string, outcomeValue: string, notes: string) {
  if (!outcomeValue.trim() || !notes.trim())
    return {
      status: "error",
      message: "Resultado e observação são obrigatórios.",
    } as ServiceResult;
  return rpc("central_decide_security_alert", {
    p_alert_id: alertId,
    p_outcome: "closed",
    p_notes: `${outcomeValue}: ${notes}`,
  });
}
export async function startProtocol(alertId: string) {
  return rpc("central_alert_action", {
    p_alert_id: alertId,
    p_action: "protocol_started",
    p_notes: null,
    p_target_operator_id: null,
  });
}
export async function addAlertNote(alertId: string, note: string) {
  if (!note.trim())
    return { status: "error", message: "A nota não pode ficar vazia." } as ServiceResult;
  return rpc("central_alert_action", {
    p_alert_id: alertId,
    p_action: "note_added",
    p_notes: note.trim(),
    p_target_operator_id: null,
  });
}
export async function transferAlert(alertId: string, targetOperatorId: string) {
  if (!targetOperatorId)
    return { status: "error", message: "Selecione o operador de destino." } as ServiceResult;
  return rpc("central_alert_action", {
    p_alert_id: alertId,
    p_action: "transferred",
    p_notes: null,
    p_target_operator_id: targetOperatorId,
  });
}
export async function escalateAlert(alertId: string, supervisorId: string) {
  if (!supervisorId)
    return { status: "error", message: "Selecione o supervisor." } as ServiceResult;
  return rpc("central_alert_action", {
    p_alert_id: alertId,
    p_action: "escalated",
    p_notes: null,
    p_target_operator_id: supervisorId,
  });
}

export async function exportAlertHistory(): Promise<ServiceResult> {
  const page = await listAlertHistory({
    ...DEFAULT_HISTORY_FILTERS,
    period: "todos",
    pageSize: 10_000,
  });
  const csv = [
    ["Protocolo", "Data", "Motorista", "Placa", "Ameaça", "Resultado", "Operador"],
    ...page.rows.map(({ alert, driverName, plate }) => [
      alert.protocol,
      alert.detectedAt,
      driverName,
      plate,
      alert.threatType,
      alert.decision?.outcome ?? "",
      alert.assignment.operatorName ?? "",
    ]),
  ]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `historico_alertas_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
  return { status: "ok" };
}
