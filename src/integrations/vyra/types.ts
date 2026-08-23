/**
 * Contratos TypeScript da Central KIRVRA.
 *
 * Nenhuma tabela foi criada. Estes tipos representam o contrato esperado
 * entre a Central e o Supabase VYRA2 (ref hwpansazevjwzdcmhssc) e serão
 * confrontados com o inventário real do schema antes de qualquer migration.
 */

/** Placeholder do tipo gerado do banco. Será substituído após o inventário. */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      alert_evidence: {
        Row: {
          id: string;
          alert_id: string | null;
          security_alert_id: string | null;
          session_id: string | null;
          driver_id: string | null;
          evidence_type: string | null;
          storage_bucket: string | null;
          storage_path: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          sha256: string | null;
          metadata: Json | null;
          captured_at: string | null;
          created_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["alert_evidence"]["Row"], "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["alert_evidence"]["Row"]>;
      };
      alerts: {
        Row: {
          id: string;
          driver_id: string | null;
          session_id: string | null;
          threat_type: string | null;
          severity: string | null;
          status: string | null;
          location_label: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["alerts"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["alerts"]["Row"]>;
      };
      security_alerts: {
        Row: {
          id: string;
          threat_type: string | null;
          confidence: number | null;
          status: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["security_alerts"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["security_alerts"]["Row"]>;
      };
      protection_sessions: {
        Row: {
          id: string;
          driver_id: string | null;
          started_at: string;
          ended_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["protection_sessions"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["protection_sessions"]["Row"]>;
      };
      drivers: {
        Row: {
          id: string;
          full_name: string;
        };
        Insert: Partial<Database["public"]["Tables"]["drivers"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["drivers"]["Row"]>;
      };
      central_audit_logs: {
        Row: {
          id: string;
          operator_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          previous_data: Json | null;
          next_data: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["central_audit_logs"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["central_audit_logs"]["Row"]>;
      };
      central_profiles: {
        Row: {
          id: string;
          full_name: string;
          employee_code: string;
        };
        Insert: Partial<Database["public"]["Tables"]["central_profiles"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["central_profiles"]["Row"]>;
      };
    };
  };
}

export type EmployeeRole =
  | "super_admin"
  | "admin"
  | "gerente"
  | "supervisor"
  | "operador"
  | "auditor";

export const EMPLOYEE_ROLE_LABEL: Record<EmployeeRole, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  gerente: "Gerente",
  supervisor: "Supervisor",
  operador: "Operador",
  auditor: "Auditor",
};

export interface CentralEmployee {
  id: string;
  employeeCode: string;
  fullName: string;
  initials: string;
  role: EmployeeRole;
  online: boolean;
  firstAccessCompleted: boolean;
  lastSeenAt: string | null;
}

export type DriverRegistrationStatus =
  | "verificado"
  | "em_analise"
  | "suspenso"
  | "pendente";

export type SubscriptionStatus = "ativa" | "pendente" | "cancelada";

export interface EmergencyContact {
  name: string;
  phone: string | null;
  relationship: string | null;
}

export interface Driver {
  id: string;
  fullName: string;
  displayName: string;
  initials: string;
  /** Sempre mascarado no transporte para cargos sem permissão de leitura. */
  maskedDocument: string;
  phone: string;
  birthDate: string | null;
  registeredAt: string;
  registrationStatus: DriverRegistrationStatus;
  subscriptionStatus: SubscriptionStatus;
  termsAccepted: boolean;
  primaryVehicleId: string | null;
  emergencyContact: EmergencyContact | null;
  lastProtectionAt: string | null;
  alertCount: number;
  confirmedAlertCount: number;
  sessionCount90d: number;
}

export interface Vehicle {
  id: string;
  driverId: string;
  make: string;
  model: string;
  year: number;
  plate: string;
  color: string;
  documentVerified: boolean;
  isPrimary: boolean;
}

export type RiskLevel = "normal" | "atencao" | "suspeito" | "critico";

export type SensorState = "ativo" | "inativo" | "indisponivel";

export interface SessionSensorStatus {
  camera: SensorState;
  audio: SensorState;
  gps: SensorState;
  network: SensorState;
  updatedAt: string;
}

export interface LiveLocation {
  latitude: number;
  longitude: number;
  address: string;
  accuracyMeters: number;
  capturedAt: string;
}

export type SessionState = "ativa" | "offline" | "encerrada";

export interface ProtectionSession {
  id: string;
  driverId: string;
  vehicleId: string;
  startedAt: string;
  endedAt: string | null;
  state: SessionState;
  riskLevel: RiskLevel;
  riskScore: number;
  lastHeartbeatAt: string;
  location: LiveLocation;
  /** Percurso normalizado (0-100) usado pelo painel de mapa. */
  track: Array<{ x: number; y: number }>;
  mapPosition: { x: number; y: number };
  sensors: SessionSensorStatus;
  alertIds: string[];
  assignedOperatorId: string | null;
}

export type AlertState =
  | "novo"
  | "assumido"
  | "em_analise"
  | "confirmado"
  | "falso_positivo"
  | "encerrado";

export type AlertSeverity = "atencao" | "suspeito" | "critico";

export interface AlertEvidence {
  id: string;
  alertId: string;
  kind: "frame" | "clipe";
  cameraLabel: string;
  capturedAt: string;
  confidence: number;
  boundingBoxLabel: string | null;
  /** URL assinada de curta duração. Nunca uma URL pública permanente. */
  signedUrl: string | null;
}

export interface AlertAudio {
  id: string;
  alertId: string;
  durationSeconds: number;
  waveform: number[];
  signedUrl: string | null;
}

export interface AlertTranscript {
  id: string;
  alertId: string;
  text: string;
  riskWords: string[];
}

export interface AlertAssignment {
  alertId: string;
  operatorId: string | null;
  operatorName: string | null;
  assignedAt: string | null;
}

export type AlertOutcome = "confirmado" | "falso_positivo" | "encerrado";

export interface AlertHumanDecision {
  alertId: string;
  outcome: AlertOutcome;
  reason: string;
  notes: string;
  decidedBy: string;
  decidedAt: string;
}

export interface Alert {
  id: string;
  protocol: string;
  driverId: string;
  vehicleId: string;
  sessionId: string;
  threatType: string;
  confidence: number;
  severity: AlertSeverity;
  state: AlertState;
  riskScore: number;
  locationLabel: string;
  detectedAt: string;
  waitingSince: string;
  assignment: AlertAssignment;
  decision: AlertHumanDecision | null;
  handlingStartedAt: string | null;
}

export interface OperationalMetric {
  id: string;
  label: string;
  value: string;
  hint: string;
}

export type ServiceHealthState = "online" | "degradado" | "offline";

export interface SystemHealth {
  id: string;
  service: string;
  state: ServiceHealthState;
  latencyMs: number | null;
  queueSize: number | null;
  note: string | null;
}

export interface AuditContext {
  actorId: string;
  actorRole: EmployeeRole;
  action: string;
  resourceType: string;
  resourceId: string;
  occurredAt: string;
}
