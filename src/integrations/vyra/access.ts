/**
 * Contratos de cargo/permissão da Central KIRVRA.
 *
 * O cargo e as permissões NUNCA são lidos de user_metadata nem enviados pelo
 * navegador: vêm das tabelas protegidas central_user_roles /
 * central_role_permissions do Supabase VYRA2, através das funções
 * SECURITY DEFINER criadas em supabase/vyra/0002_kirvra_central_access.sql.
 */
import type { EmployeeRole } from "./types";

export const PERMISSION_CODES = [
  "dashboard.view",
  "sessions.view",
  "location.view",
  "alerts.view",
  "alerts.handle",
  "alerts.take",
  "alerts.transfer",
  "alerts.close",
  "evidence.view",
  "evidence.audio",
  "evidence.image",
  "drivers.view",
  "vehicles.view",
  "employees.manage",
  "roles.manage",
  "schedules.manage",
  "audit.view",
  "reports.view",
  "health.view",
  "settings.manage",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export function isPermissionCode(value: unknown): value is PermissionCode {
  return (
    typeof value === "string" &&
    (PERMISSION_CODES as readonly string[]).includes(value)
  );
}

export type CentralProfileStatus = "ativo" | "inativo" | "bloqueado";

export interface CentralProfile {
  id: string;
  employeeCode: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  status: CentralProfileStatus;
  primeiroAcesso: boolean;
  lastAccessAt: string | null;
}

export interface CentralAccess {
  profile: CentralProfile;
  role: EmployeeRole;
  permissions: PermissionCode[];
}

/** Motivos de negação de acesso. Nenhum deles concede sessão. */
export type AccessDenialReason =
  | "no_profile"
  | "inactive"
  | "blocked"
  | "no_role"
  | "no_permission";

export const ACCESS_DENIAL_MESSAGE: Record<AccessDenialReason, string> = {
  no_profile:
    "Esta conta não possui perfil interno na Central KIRVRA. Acesso negado.",
  inactive: "Conta inativa. Procure o supervisor responsável.",
  blocked: "Conta bloqueada. Acesso à Central suspenso.",
  no_role:
    "Nenhum cargo válido atribuído a esta conta. Acesso à Central negado.",
  no_permission: "Seu cargo não possui permissão para esta área da Central.",
};

/** Permissões mínimas por rota oficial da Central. */
export const ROUTE_PERMISSIONS: Record<string, PermissionCode[]> = {
  "/central": ["dashboard.view"],
  "/monitoramento": ["sessions.view", "location.view"],
  "/alertas": ["alerts.view"],
  "/historico/alertas": ["alerts.view"],
  "/sessoes": ["sessions.view"],
  "/motoristas": ["drivers.view"],
  "/veiculos": ["vehicles.view"],
  "/evidencias": ["evidence.view"],
  "/equipe": ["employees.manage"],
  "/escalas": ["schedules.manage"],
  "/relatorios": ["reports.view"],
  "/auditoria": ["audit.view"],
  "/saude-do-sistema": ["health.view"],
  "/configuracoes": ["settings.manage"],
};
