/**
 * Middleware de server function que valida o bearer token do Supabase VYRA2.
 *
 * Regras:
 * - Autorização nunca se apoia em user_metadata (campo editável pelo usuário).
 * - Cargos virão de app_metadata ou de tabela protegida após o inventário.
 * - Enquanto as credenciais VYRA não existirem, o middleware falha de forma
 *   explícita ("Integração pendente"), sem liberar acesso.
 */
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { createVyraServerClient, readVyraServerConfig } from "./client.server";
import type { EmployeeRole } from "./types";

export class VyraIntegrationPendingError extends Error {
  constructor() {
    super(
      "Integração pendente: credenciais do Supabase VYRA2 não configuradas.",
    );
    this.name = "VyraIntegrationPendingError";
  }
}

const KNOWN_ROLES: EmployeeRole[] = [
  "super_admin",
  "admin",
  "gerente",
  "supervisor",
  "operador",
  "auditor",
];

/** Extrai o cargo apenas de app_metadata; jamais de user_metadata. */
export function roleFromAppMetadata(claims: unknown): EmployeeRole | null {
  if (!claims || typeof claims !== "object") return null;
  const appMetadata = (claims as { app_metadata?: unknown }).app_metadata;
  if (!appMetadata || typeof appMetadata !== "object") return null;
  const role = (appMetadata as { kirvra_role?: unknown }).kirvra_role;
  return typeof role === "string" && KNOWN_ROLES.includes(role as EmployeeRole)
    ? (role as EmployeeRole)
    : null;
}

export const requireVyraAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    if (!readVyraServerConfig()) {
      throw new VyraIntegrationPendingError();
    }

    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Não autorizado: sessão ausente.");
    }

    const token = authHeader.slice("Bearer ".length);
    if (!token || token.split(".").length !== 3) {
      throw new Error("Não autorizado: token inválido.");
    }

    const supabase = createVyraServerClient(token);
    if (!supabase) throw new VyraIntegrationPendingError();

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new Error("Não autorizado: sessão inválida ou expirada.");
    }

    return next({
      context: {
        supabase,
        userId: data.user.id,
        role: roleFromAppMetadata(data.user),
      },
    });
  },
);

/** Middleware de cliente que anexa o bearer token do VYRA2 às chamadas. */
export const attachVyraAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (typeof window === "undefined") return next({ headers: {} });
    const { getVyraClient } = await import("./client");
    const client = getVyraClient();
    if (!client) return next({ headers: {} });
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);
