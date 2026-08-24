import { getVyraClient } from "@/integrations/vyra/client";
import type {
  Alert,
  Driver,
  ProtectionSession,
  RiskLevel,
  SensorState,
  SessionState,
  Vehicle,
} from "@/integrations/vyra/types";
import type { ServiceResult } from "./auth-service";
import { getAlertDetail } from "./alert-service";
import { getDriverDetail } from "./driver-service";

export interface SessionDetail {
  session: ProtectionSession;
  driver: Driver;
  vehicle: Vehicle | null;
  sessionAlerts: Alert[];
}

type SessionDb = {
  id: string;
  driver_id: string;
  vehicle_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  current_risk_level: string;
  current_risk_score: number;
  last_heartbeat_at: string | null;
  camera_connected: boolean;
  audio_monitoring_enabled: boolean;
  gps_enabled: boolean;
  current_latitude?: number | null;
  current_longitude?: number | null;
  location_accuracy_meters?: number | null;
  location_updated_at?: string | null;
};

function client() {
  const value = getVyraClient();
  if (!value) throw new Error("Supabase VYRA2 não configurado.");
  return value;
}

function sensor(value: boolean): SensorState {
  return value ? "ativo" : "inativo";
}
function risk(value: string): RiskLevel {
  if (["critical", "critico", "crítico"].includes(value)) return "critico";
  if (["high", "suspicious", "suspeito"].includes(value)) return "suspeito";
  if (["medium", "warning", "atencao", "atenção"].includes(value)) return "atencao";
  return "normal";
}
function state(value: string): SessionState {
  if (["ended", "closed", "encerrada"].includes(value)) return "encerrada";
  if (["offline", "disconnected"].includes(value)) return "offline";
  return "ativa";
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const db = client();
  const { data, error } = await db
    .from("protection_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as SessionDb;
  const driverDetail = await getDriverDetail(row.driver_id);
  if (!driverDetail) return null;
  const { data: alertRows, error: alertError } = await db
    .from("security_alerts")
    .select("id")
    .eq("session_id", sessionId)
    .order("detected_at", { ascending: false });
  if (alertError) throw alertError;
  const alertDetails = await Promise.all(
    (alertRows ?? []).map((alertRow) => getAlertDetail(alertRow.id)),
  );
  const sessionAlerts = alertDetails
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .map((item) => item.alert);
  const heartbeat = row.last_heartbeat_at ?? row.started_at;
  const latitude = row.current_latitude ?? 0;
  const longitude = row.current_longitude ?? 0;
  const hasLocation = latitude !== 0 || longitude !== 0;
  const session: ProtectionSession = {
    id: row.id,
    driverId: row.driver_id,
    vehicleId: row.vehicle_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    state: state(row.status),
    riskLevel: risk(row.current_risk_level),
    riskScore: row.current_risk_score,
    lastHeartbeatAt: heartbeat,
    location: {
      latitude,
      longitude,
      accuracyMeters: row.location_accuracy_meters ?? 0,
      address: hasLocation
        ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        : "Localização ainda não enviada pelo aplicativo",
      capturedAt: row.location_updated_at ?? heartbeat,
    },
    track: [],
    mapPosition: { x: 50, y: 50 },
    sensors: {
      camera: sensor(row.camera_connected),
      audio: sensor(row.audio_monitoring_enabled),
      gps: sensor(row.gps_enabled),
      network: row.last_heartbeat_at ? "ativo" : "indisponivel",
      updatedAt: heartbeat,
    },
    alertIds: sessionAlerts.map((alert) => alert.id),
    assignedOperatorId: sessionAlerts[0]?.assignment.operatorId ?? null,
  };
  return {
    session,
    driver: driverDetail.driver,
    vehicle: driverDetail.vehicles.find((vehicle) => vehicle.id === row.vehicle_id) ?? null,
    sessionAlerts,
  };
}

async function action(
  sessionId: string,
  actionName: string,
  notes: string,
): Promise<ServiceResult> {
  const { error } = await client().rpc("central_session_action", {
    p_session_id: sessionId,
    p_action: actionName,
    p_notes: notes,
  });
  if (error) return { status: "error", message: `Operação não concluída: ${error.message}` };
  return { status: "ok" };
}

export async function addSessionNote(sessionId: string, note: string): Promise<ServiceResult> {
  if (!note.trim()) return { status: "error", message: "A observação não pode ficar vazia." };
  return action(sessionId, "note_added", note.trim());
}

export async function escalateSession(sessionId: string, reason: string): Promise<ServiceResult> {
  if (!reason.trim()) return { status: "error", message: "Informe o motivo da escalada." };
  return action(sessionId, "escalated", reason.trim());
}
