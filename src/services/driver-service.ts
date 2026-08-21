/**
 * Motoristas cadastrados e detalhe do perfil.
 * A Central não cria cadastro de motorista nesta etapa.
 */
import type {
  Driver,
  DriverRegistrationStatus,
  SubscriptionStatus,
  Vehicle,
} from "@/integrations/vyra/types";
import {
  driverActivity,
  drivers,
  findDriver,
  vehicles,
  type DriverActivityEntry,
} from "@/mocks/kirvra-central";
import type { ServiceResult } from "./auth-service";

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

export async function listDrivers(
  filters: DriverFilters,
): Promise<DriverPage> {
  const term = filters.search.trim().toLowerCase();
  const filtered = drivers
    .filter(
      (d) =>
        !term ||
        d.displayName.toLowerCase().includes(term) ||
        d.fullName.toLowerCase().includes(term),
    )
    .filter(
      (d) => filters.status === "todos" || d.registrationStatus === filters.status,
    )
    .filter(
      (d) =>
        filters.subscription === "todos" ||
        d.subscriptionStatus === filters.subscription,
    );

  const start = (filters.page - 1) * filters.pageSize;
  return {
    rows: filtered.slice(start, start + filters.pageSize).map((driver) => ({
      driver,
      primaryVehicle:
        vehicles.find((v) => v.id === driver.primaryVehicleId) ?? null,
    })),
    total: filtered.length,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export interface DriverDetail {
  driver: Driver;
  vehicles: Vehicle[];
  primaryVehicle: Vehicle | null;
  activity: DriverActivityEntry[];
}

export async function getDriverDetail(
  driverId: string,
): Promise<DriverDetail | null> {
  const driver = findDriver(driverId);
  if (!driver) return null;
  const driverVehicles = vehicles.filter((v) => v.driverId === driverId);
  return {
    driver,
    vehicles: driverVehicles,
    primaryVehicle: driverVehicles.find((v) => v.isPrimary) ?? null,
    activity: driverActivity[driverId] ?? [],
  };
}

export async function suspendDriver(
  _driverId: string,
  reason: string,
): Promise<ServiceResult> {
  if (!reason.trim())
    return { status: "error", message: "O motivo da suspensão é obrigatório." };
  return {
    status: "pending",
    message:
      "Integração pendente: a suspensão só será aplicada por função segura no Supabase VYRA2.",
  };
}

export async function exportDriverList(): Promise<ServiceResult> {
  return {
    status: "pending",
    message:
      "Integração pendente: exportação depende de permissão e backend seguro.",
  };
}
