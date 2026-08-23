/**
 * Leitura segura de perfil, cargo e permissões da Central no Supabase VYRA2.
 *
 * Tudo aqui depende da migration supabase/vyra/0002_kirvra_central_access.sql,
 * que ainda NÃO foi aplicada automaticamente. Enquanto as tabelas/funções não
 * existirem, o serviço devolve status "error" com motivo explícito — nunca
 * concede acesso e nunca simula sucesso.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isPermissionCode,
  type AccessDenialReason,
  type CentralAccess,
  type CentralProfile,
  type CentralProfileStatus,
  type PermissionCode,
} from "@/integrations/vyra/access";
import type { EmployeeRole } from "@/integrations/vyra/types";

const KNOWN_ROLES: EmployeeRole[] = [
  "super_admin",
  "admin",
  "gerente",
  "supervisor",
  "operador",
  "auditor",
];

export type AccessResult =
  | { status: "ok"; access: CentralAccess }
  | { status: "denied"; reason: AccessDenialReason }
  | { status: "error"; message: string; missingMigration: boolean };

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

function isMissingSchema(error: PostgrestLikeError | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  return (
    code === "42P01" ||
    code === "42883" ||
    code === "PGRST202" ||
    code === "PGRST205"
  );
}

function migrationPendingMessage(): string {
  return "Estruturas de acesso da Central ausentes no VYRA2. Aplique a migration supabase/vyra/0002_kirvra_central_access.sql antes de liberar o acesso.";
}

function normalizeStatus(value: unknown): CentralProfileStatus | null {
  return value === "ativo" || value === "inativo" || value === "bloqueado"
    ? value
    : null;
}

function initialsFrom(fullName: string): string {
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "KV";
}

export function employeeInitials(fullName: string): string {
  return initialsFrom(fullName);
}

/**
 * Carrega o acesso interno do usuário autenticado.
 * Ordem obrigatória: perfil → status ativo → cargo → permissões.
 */
export async function loadCentralAccess(
  client: SupabaseClient,
  userId: string,
): Promise<AccessResult> {
  const profileResponse = await client
    .from("central_profiles")
    .select(
      "id, employee_code, full_name, phone, avatar_url, status, primeiro_acesso, last_access_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileResponse.error) {
    const error = profileResponse.error as PostgrestLikeError;
    if (isMissingSchema(error)) {
      return {
        status: "error",
        message: migrationPendingMessage(),
        missingMigration: true,
      };
    }
    return {
      status: "error",
      message: "Não foi possível ler o perfil interno da Central.",
      missingMigration: false,
    };
  }

  const row = profileResponse.data as Record<string, unknown> | null;
  if (!row) return { status: "denied", reason: "no_profile" };

  const status = normalizeStatus(row["status"]);
  if (status === "bloqueado") return { status: "denied", reason: "blocked" };
  if (status !== "ativo") return { status: "denied", reason: "inactive" };

  const fullName =
    typeof row["full_name"] === "string" && row["full_name"].trim()
      ? (row["full_name"] as string)
      : "Funcionário";

  const profile: CentralProfile = {
    id: userId,
    employeeCode:
      typeof row["employee_code"] === "string" ? row["employee_code"] : "",
    fullName,
    phone: typeof row["phone"] === "string" ? row["phone"] : null,
    avatarUrl:
      typeof row["avatar_url"] === "string" ? row["avatar_url"] : null,
    status,
    primeiroAcesso: row["primeiro_acesso"] === true,
    lastAccessAt:
      typeof row["last_access_at"] === "string" ? row["last_access_at"] : null,
  };

  const roleResponse = await client.rpc("central_role");
  if (roleResponse.error) {
    const error = roleResponse.error as PostgrestLikeError;
    return {
      status: "error",
      message: isMissingSchema(error)
        ? migrationPendingMessage()
        : "Não foi possível validar o cargo interno.",
      missingMigration: isMissingSchema(error),
    };
  }

  const roleCode = roleResponse.data;
  if (
    typeof roleCode !== "string" ||
    !KNOWN_ROLES.includes(roleCode as EmployeeRole)
  ) {
    return { status: "denied", reason: "no_role" };
  }

  const permissionsResponse = await client.rpc("central_my_permissions");
  if (permissionsResponse.error) {
    const error = permissionsResponse.error as PostgrestLikeError;
    return {
      status: "error",
      message: isMissingSchema(error)
        ? migrationPendingMessage()
        : "Não foi possível carregar as permissões do cargo.",
      missingMigration: isMissingSchema(error),
    };
  }

  const rawPermissions = Array.isArray(permissionsResponse.data)
    ? (permissionsResponse.data as unknown[])
    : [];
  const permissions: PermissionCode[] = rawPermissions
    .map((entry) =>
      typeof entry === "string"
        ? entry
        : entry && typeof entry === "object"
          ? ((entry as Record<string, unknown>)["central_my_permissions"] ??
            (entry as Record<string, unknown>)["code"])
          : null,
    )
    .filter(isPermissionCode);

  if (permissions.length === 0) {
    return { status: "denied", reason: "no_permission" };
  }

  return {
    status: "ok",
    access: { profile, role: roleCode as EmployeeRole, permissions },
  };
}

/** Registra evento de auditoria. Falha silenciosa nunca é aceitável. */
export async function logCentralEvent(
  client: SupabaseClient,
  input: {
    action: string;
    entity: string;
    entityId?: string | null;
    next?: Record<string, unknown> | null;
  },
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await client.rpc("central_log_event", {
    _action: input.action,
    _entity: input.entity,
    _entity_id: input.entityId ?? null,
    _previous: null,
    _next: input.next ?? null,
    _user_agent:
      typeof navigator !== "undefined" ? navigator.userAgent : null,
  });
  if (error) {
    return { ok: false, message: "Não foi possível registrar a auditoria." };
  }
  return { ok: true };
}

/** Marca primeiro acesso como concluído (função SECURITY DEFINER). */
export async function completeFirstAccessOnServer(
  client: SupabaseClient,
): Promise<{ ok: boolean; message?: string }> {
  const { data, error } = await client.rpc("central_complete_first_access", {
    _user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  });
  if (error || data !== true) {
    return {
      ok: false,
      message:
        error && isMissingSchema(error as PostgrestLikeError)
          ? migrationPendingMessage()
          : "Não foi possível concluir o primeiro acesso no servidor.",
    };
  }
  return { ok: true };
}
