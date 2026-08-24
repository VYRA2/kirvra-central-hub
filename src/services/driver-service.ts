import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { getVyraClient } from "@/integrations/vyra/client";
import type {
  Driver,
  DriverRegistrationStatus,
  SubscriptionStatus,
  Vehicle,
} from "@/integrations/vyra/types";

export interface DriverFilters {
  search: string;
  status: DriverRegistrationStatus | "todos";
  subscription: SubscriptionStatus | "todos";
  page: number;
  pageSize: number;
}

export const DEFAULT_DRIVER_FILTERS: DriverFilters = {
  search: "",
  status: "todos",
  subscription: "todos",
  page: 1,
  pageSize: 10,
};

export interface DriverRow {
  driver: Driver;
  primaryVehicle: Vehicle | null;
}

export interface DriverPage {
  rows: DriverRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DriverActivityEntry {
  id: string;
  type: "session" | "alert";
  title: string;
  detail: string;
  occurredAt: string;
  tone: "neutral" | "critical";
}

export interface DriverDetail {
  driver: Driver;
  vehicles: Vehicle[];
  primaryVehicle: Vehicle | null;
  activity: DriverActivityEntry[];
}

type DriverDb = {
  id: string;
  full_name: string | null;
  phone: string | null;
  cpf: string | null;
  birth_date: string | null;
  subscription_status: string;
  registration_status?: string | null;
  terms_accepted_at: string | null;
  data_processing_consent_at: string | null;
  identity_document_path: string | null;
  selfie_path: string | null;
  created_at: string;
};

type VehicleDb = {
  id: string;
  driver_id: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
  color: string | null;
  verification_status: string;
  created_at: string;
};

type SessionDb = {
  id: string;
  driver_id: string;
  vehicle_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
};

type AlertDb = {
  id: string;
  driver_id: string | null;
  threat_type: string;
  status: string;
  risk_level: string;
  detected_at: string;
};

function getClient() {
  const client = getVyraClient();
  if (!client) throw new Error("Supabase VYRA2 não configurado.");
  return client;
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "MO"
  );
}

function maskCpf(value: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return "Não informado";
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

function subscriptionStatus(value: string): SubscriptionStatus {
  if (value === "active" || value === "ativa") return "ativa";
  if (value === "cancelled" || value === "canceled" || value === "cancelada") return "cancelada";
  return "pendente";
}

function registrationStatus(driver: DriverDb): DriverRegistrationStatus {
  switch (driver.registration_status) {
    case "verified":
    case "verificado":
      return "verificado";
    case "suspended":
    case "suspenso":
      return "suspenso";
    case "reviewing":
    case "em_analise":
      return "em_analise";
    default:
      return "pendente";
  }
}

function toVehicle(vehicle: VehicleDb, isPrimary: boolean): Vehicle {
  return {
    id: vehicle.id,
    driverId: vehicle.driver_id,
    make: vehicle.brand ?? "Marca não informada",
    model: vehicle.model ?? "Modelo não informado",
    year: vehicle.year ?? 0,
    plate: vehicle.plate ?? "Sem placa",
    color: vehicle.color ?? "Cor não informada",
    documentVerified: vehicle.verification_status === "verified",
    isPrimary,
  };
}

function toDriver(
  driver: DriverDb,
  driverVehicles: VehicleDb[],
  driverSessions: SessionDb[],
  driverAlerts: AlertDb[],
): Driver {
  const name = driver.full_name?.trim() || "Motorista sem nome";
  const newestVehicle = [...driverVehicles].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )[0];
  const newestSession = [...driverSessions].sort((a, b) =>
    b.started_at.localeCompare(a.started_at),
  )[0];
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;

  return {
    id: driver.id,
    fullName: name,
    displayName: name,
    initials: initials(name),
    maskedDocument: maskCpf(driver.cpf),
    phone: driver.phone ?? "Não informado",
    birthDate: driver.birth_date,
    registeredAt: driver.created_at,
    registrationStatus: registrationStatus(driver),
    subscriptionStatus: subscriptionStatus(driver.subscription_status),
    termsAccepted: Boolean(driver.terms_accepted_at && driver.data_processing_consent_at),
    primaryVehicleId: newestVehicle?.id ?? null,
    emergencyContact: null,
    lastProtectionAt: newestSession?.started_at ?? null,
    alertCount: driverAlerts.length,
    confirmedAlertCount: driverAlerts.filter((alert) => alert.status === "confirmed").length,
    sessionCount90d: driverSessions.filter(
      (session) => new Date(session.started_at).getTime() >= cutoff,
    ).length,
  };
}

async function loadDriverContext(driverId?: string) {
  const client = getClient();
  let driverQuery = client.from("drivers").select("*").order("created_at", { ascending: false });
  if (driverId) driverQuery = driverQuery.eq("id", driverId);

  const [driversResult, vehiclesResult, sessionsResult, alertsResult] = await Promise.all([
    driverQuery,
    client
      .from("vehicles")
      .select("id,driver_id,brand,model,year,plate,color,verification_status,created_at"),
    client.from("protection_sessions").select("id,driver_id,vehicle_id,status,started_at,ended_at"),
    client.from("security_alerts").select("id,driver_id,threat_type,status,risk_level,detected_at"),
  ]);

  const error =
    driversResult.error ?? vehiclesResult.error ?? sessionsResult.error ?? alertsResult.error;
  if (error) throw error;

  return {
    drivers: (driversResult.data ?? []) as DriverDb[],
    vehicles: (vehiclesResult.data ?? []) as VehicleDb[],
    sessions: (sessionsResult.data ?? []) as SessionDb[],
    alerts: (alertsResult.data ?? []) as AlertDb[],
  };
}

export async function listDrivers(filters: DriverFilters): Promise<DriverPage> {
  const context = await loadDriverContext();
  const rows = context.drivers.map((dbDriver) => {
    const vehicles = context.vehicles.filter((vehicle) => vehicle.driver_id === dbDriver.id);
    const sessions = context.sessions.filter((session) => session.driver_id === dbDriver.id);
    const alerts = context.alerts.filter((alert) => alert.driver_id === dbDriver.id);
    const driver = toDriver(dbDriver, vehicles, sessions, alerts);
    const primary = vehicles.find((vehicle) => vehicle.id === driver.primaryVehicleId) ?? null;
    return { driver, primaryVehicle: primary ? toVehicle(primary, true) : null };
  });

  const term = filters.search.trim().toLocaleLowerCase("pt-BR");
  const filtered = rows.filter(({ driver, primaryVehicle }) => {
    const matchesSearch =
      !term ||
      [
        driver.fullName,
        driver.phone,
        driver.maskedDocument,
        primaryVehicle?.plate,
        primaryVehicle?.make,
        primaryVehicle?.model,
      ].some((value) => value?.toLocaleLowerCase("pt-BR").includes(term));
    return (
      matchesSearch &&
      (filters.status === "todos" || driver.registrationStatus === filters.status) &&
      (filters.subscription === "todos" || driver.subscriptionStatus === filters.subscription)
    );
  });

  const start = (filters.page - 1) * filters.pageSize;
  return {
    rows: filtered.slice(start, start + filters.pageSize),
    total: filtered.length,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function getDriverDetail(driverId: string): Promise<DriverDetail | null> {
  const context = await loadDriverContext(driverId);
  const dbDriver = context.drivers[0];
  if (!dbDriver) return null;

  const dbVehicles = context.vehicles.filter((vehicle) => vehicle.driver_id === driverId);
  const sessions = context.sessions.filter((session) => session.driver_id === driverId);
  const alerts = context.alerts.filter((alert) => alert.driver_id === driverId);
  const driver = toDriver(dbDriver, dbVehicles, sessions, alerts);
  const vehicles = dbVehicles.map((vehicle) =>
    toVehicle(vehicle, vehicle.id === driver.primaryVehicleId),
  );
  const activity: DriverActivityEntry[] = [
    ...sessions.map((session) => ({
      id: `session-${session.id}`,
      type: "session" as const,
      title: session.status === "active" ? "Proteção iniciada" : "Sessão de proteção",
      detail: session.status === "active" ? "Sessão ativa" : "Sessão encerrada",
      occurredAt: session.started_at,
      tone: "neutral" as const,
    })),
    ...alerts.map((alert) => ({
      id: `alert-${alert.id}`,
      type: "alert" as const,
      title: "Alerta de segurança",
      detail: alert.threat_type || "Sinal de risco",
      occurredAt: alert.detected_at,
      tone: alert.risk_level === "critical" ? ("critical" as const) : ("neutral" as const),
    })),
  ]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 10);

  return {
    driver,
    vehicles,
    primaryVehicle: vehicles.find((vehicle) => vehicle.isPrimary) ?? null,
    activity,
  };
}

export function formatDriverActivityDate(value: string | null) {
  if (!value) return "Nunca";
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: ptBR });
}

export function exportDriversToCsv(rows: DriverRow[]) {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    ["Motorista", "Telefone", "CPF", "Assinatura", "Cadastro", "Veículo", "Placa"],
    ...rows.map(({ driver, primaryVehicle }) => [
      driver.fullName,
      driver.phone,
      driver.maskedDocument,
      driver.subscriptionStatus,
      driver.registrationStatus,
      primaryVehicle ? `${primaryVehicle.make} ${primaryVehicle.model}` : "",
      primaryVehicle?.plate ?? "",
    ]),
  ].map((line) => line.map(escape).join(","));

  const blob = new Blob([`\ufeff${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `motoristas_kirvra_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
