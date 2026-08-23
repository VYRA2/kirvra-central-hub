/**
 * Sessão protegida — leitura e ações operacionais.
 * Ações críticas retornam "pending" enquanto o backend seguro não existir.
 */
import type {
  Alert,
  Driver,
  ProtectionSession,
  Vehicle,
} from "@/integrations/vyra/types";
import { isVyraConfigured } from "@/integrations/vyra/client";
import {
  alerts,
  findDriver,
  findSession,
  findVehicle,
} from "@/mocks/kirvra-central";
import type { ServiceResult } from "./auth-service";
import { assertDemoData } from "./mock-guard";

export interface SessionDetail {
  session: ProtectionSession;
  driver: Driver;
  vehicle: Vehicle | null;
  sessionAlerts: Alert[];
}

export async function getSessionDetail(
  sessionId: string,
): Promise<SessionDetail | null> {
  assertDemoData();
  const session = findSession(sessionId);
  if (!session) return null;
  const driver = findDriver(session.driverId);
  if (!driver) return null;
  return {
    session,
    driver,
    vehicle: findVehicle(session.vehicleId),
    sessionAlerts: alerts.filter((a) => session.alertIds.includes(a.id)),
  };
}

const PENDING: ServiceResult = {
  status: "pending",
  message:
    "Integração pendente: a operação será gravada quando o Supabase VYRA2 estiver configurado.",
};

export async function addSessionNote(
  _sessionId: string,
  note: string,
): Promise<ServiceResult> {
  assertDemoData();
  if (!note.trim())
    return { status: "error", message: "A observação não pode ficar vazia." };
  if (!isVyraConfigured()) return PENDING;
  return PENDING;
}

export async function escalateSession(
  _sessionId: string,
  reason: string,
): Promise<ServiceResult> {
  assertDemoData();
  if (!reason.trim())
    return { status: "error", message: "Informe o motivo da escalada." };
  return PENDING;
}
