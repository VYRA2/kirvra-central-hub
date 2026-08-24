/**
 * Normalizadores tolerantes de esquema para as tabelas EXISTENTES do VYRA2
 * (protection_sessions, alerts, drivers, vehicles).
 *
 * O inventário de colunas do projeto VYRA2 não pôde ser lido (as variáveis
 * VITE_VYRA_SUPABASE_* / VYRA_SUPABASE_* ainda não estão definidas neste
 * ambiente). Por isso a leitura é feita com `select('*')` e cada campo é
 * resolvido por nomes candidatos. Nada é inventado: quando um campo não existe,
 * o valor resultante é `null` e a interface mostra estado vazio.
 */
import type { RiskLevel, SensorState, SessionState } from "./types";

type Row = Record<string, unknown>;

function pick(row: Row, keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) return value;
  }
  return null;
}

export function readString(row: Row, keys: string[]): string | null {
  const value = pick(row, keys);
  return typeof value === "string" && value.trim() ? value : null;
}

export function readNumber(row: Row, keys: string[]): number | null {
  const value = pick(row, keys);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function readIso(row: Row, keys: string[]): string | null {
  const value = pick(row, keys);
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Só devolve ponto quando as duas coordenadas são válidas e plausíveis. */
export function readGeoPoint(row: Row): GeoPoint | null {
  const latitude = readNumber(row, [
    "latitude",
    "lat",
    "last_latitude",
    "current_latitude",
    "location_latitude",
  ]);
  const longitude = readNumber(row, [
    "longitude",
    "lng",
    "lon",
    "last_longitude",
    "current_longitude",
    "location_longitude",
  ]);
  if (latitude === null || longitude === null) return null;
  if (latitude === 0 && longitude === 0) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

const RISK_MAP: Record<string, RiskLevel> = {
  normal: "normal",
  low: "normal",
  baixo: "normal",
  atencao: "atencao",
  atenção: "atencao",
  medium: "atencao",
  medio: "atencao",
  warning: "atencao",
  suspeito: "suspeito",
  suspicious: "suspeito",
  high: "suspeito",
  alto: "suspeito",
  critico: "critico",
  crítico: "critico",
  critical: "critico",
};

export function readRiskLevel(row: Row): RiskLevel | null {
  const raw = readString(row, ["risk_level", "risk", "severity", "nivel_risco"]);
  if (!raw) return null;
  return RISK_MAP[raw.toLowerCase()] ?? null;
}

const SESSION_STATE_MAP: Record<string, SessionState> = {
  active: "ativa",
  ativa: "ativa",
  ativo: "ativa",
  running: "ativa",
  offline: "offline",
  disconnected: "offline",
  ended: "encerrada",
  encerrada: "encerrada",
  finished: "encerrada",
  closed: "encerrada",
};

export function readSessionState(row: Row): SessionState | null {
  const raw = readString(row, ["state", "status", "session_status"]);
  if (!raw) return null;
  return SESSION_STATE_MAP[raw.toLowerCase()] ?? null;
}

function readSensor(row: Row, keys: string[]): SensorState {
  const value = pick(row, keys);
  if (typeof value === "boolean") return value ? "ativo" : "inativo";
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["ativo", "active", "on", "ok", "true"].includes(normalized)) {
      return "ativo";
    }
    if (["inativo", "inactive", "off", "false"].includes(normalized)) {
      return "inativo";
    }
  }
  return "indisponivel";
}

export interface LiveSensors {
  camera: SensorState;
  audio: SensorState;
  gps: SensorState;
  network: SensorState;
}

export interface LiveSession {
  id: string;
  driverId: string | null;
  vehicleId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  state: SessionState | null;
  riskLevel: RiskLevel | null;
  lastHeartbeatAt: string | null;
  /** `null` quando a sessão não possui localização válida no banco. */
  point: GeoPoint | null;
  address: string | null;
  accuracyMeters: number | null;
  sensors: LiveSensors;
  /** Dados de apresentação resolvidos por join local. */
  driverName: string | null;
  vehicleLabel: string | null;
  plate: string | null;
  alertIds: string[];
}

export function normalizeSession(row: Row): LiveSession | null {
  const id = readString(row, ["id", "session_id", "uuid"]);
  if (!id) return null;

  return {
    id,
    driverId: readString(row, ["driver_id", "user_id", "driverId"]),
    vehicleId: readString(row, ["vehicle_id", "vehicleId"]),
    startedAt: readIso(row, ["started_at", "start_time", "created_at"]),
    endedAt: readIso(row, ["ended_at", "end_time", "finished_at"]),
    state: readSessionState(row),
    riskLevel: readRiskLevel(row),
    lastHeartbeatAt: readIso(row, [
      "last_heartbeat_at",
      "heartbeat_at",
      "last_seen_at",
      "updated_at",
    ]),
    point: readGeoPoint(row),
    address: readString(row, ["address", "last_address", "location_address"]),
    accuracyMeters: readNumber(row, ["accuracy", "accuracy_meters"]),
    sensors: {
      camera: readSensor(row, ["camera_status", "camera_active", "camera"]),
      audio: readSensor(row, ["audio_status", "audio_active", "audio"]),
      gps: readSensor(row, ["gps_status", "gps_active", "gps"]),
      network: readSensor(row, ["network_status", "network", "connectivity"]),
    },
    driverName: null,
    vehicleLabel: null,
    plate: null,
    alertIds: [],
  };
}

export interface LiveAlert {
  id: string;
  protocol: string | null;
  driverId: string | null;
  sessionId: string | null;
  threatType: string | null;
  confidence: number | null;
  severity: RiskLevel | null;
  status: string | null;
  detectedAt: string | null;
  locationLabel: string | null;
  driverName: string | null;
}

/** Heartbeat válido conforme ao limite operacional de 5 minutos. */
export function isRecentHeartbeat(value: string | null, now = Date.now()): boolean {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && now - timestamp >= 0 && now - timestamp <= 5 * 60 * 1000;
}

const OPEN_STATUS = ["novo", "new", "pending", "open", "aberto", "created"];
const HANDLING_STATUS = [
  "assumido",
  "em_analise",
  "in_progress",
  "handling",
  "assigned",
  "em_atendimento",
];

export function isOpenAlert(alert: LiveAlert): boolean {
  return !alert.status || OPEN_STATUS.includes(alert.status.toLowerCase());
}

export function isHandlingAlert(alert: LiveAlert): boolean {
  return Boolean(alert.status && HANDLING_STATUS.includes(alert.status.toLowerCase()));
}

export function normalizeAlert(row: Row): LiveAlert | null {
  const id = readString(row, ["id", "alert_id", "uuid"]);
  if (!id) return null;
  return {
    id,
    protocol: readString(row, ["protocol", "code", "reference"]),
    driverId: readString(row, ["driver_id", "user_id"]),
    sessionId: readString(row, ["session_id", "protection_session_id"]),
    threatType: readString(row, ["threat_type", "alert_type", "type", "category"]),
    confidence: readNumber(row, ["confidence", "score", "ai_confidence"]),
    severity: readRiskLevel(row),
    status: readString(row, ["status", "state"]),
    detectedAt: readIso(row, ["detected_at", "created_at", "occurred_at"]),
    locationLabel: readString(row, ["address", "location", "location_label"]),
    driverName: null,
  };
}

export interface LiveDriver {
  id: string;
  name: string | null;
  phone: string | null;
}

export function normalizeDriver(row: Row): LiveDriver | null {
  const id = readString(row, ["id", "driver_id", "user_id"]);
  if (!id) return null;
  return {
    id,
    name: readString(row, ["full_name", "name", "display_name", "nome"]),
    phone: readString(row, ["phone", "phone_number", "telefone"]),
  };
}

export interface LiveVehicle {
  id: string;
  driverId: string | null;
  label: string | null;
  plate: string | null;
}

export function normalizeVehicle(row: Row): LiveVehicle | null {
  const id = readString(row, ["id", "vehicle_id"]);
  if (!id) return null;
  const make = readString(row, ["make", "brand", "marca"]);
  const model = readString(row, ["model", "modelo"]);
  const label = [make, model].filter(Boolean).join(" ") || null;
  return {
    id,
    driverId: readString(row, ["driver_id", "user_id"]),
    label,
    plate: readString(row, ["plate", "license_plate", "placa"]),
  };
}

export function joinSessionContext(
  sessions: LiveSession[],
  drivers: LiveDriver[],
  vehicles: LiveVehicle[],
  alerts: LiveAlert[],
): LiveSession[] {
  const driverById = new Map(drivers.map((d) => [d.id, d]));
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));

  return sessions.map((session) => {
    const driver = session.driverId ? driverById.get(session.driverId) : null;
    const vehicle = session.vehicleId
      ? vehicleById.get(session.vehicleId)
      : (vehicles.find((v) => v.driverId && v.driverId === session.driverId) ?? null);

    return {
      ...session,
      driverName: driver?.name ?? null,
      vehicleLabel: vehicle?.label ?? null,
      plate: vehicle?.plate ?? null,
      alertIds: alerts.filter((alert) => alert.sessionId === session.id).map((alert) => alert.id),
    };
  });
}
