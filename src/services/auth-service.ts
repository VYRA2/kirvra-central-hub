/**
 * Serviço de autenticação da Central KIRVRA.
 *
 * Alvo exclusivo: Supabase VYRA2 (ref hwpansazevjwzdcmhssc) via
 * src/integrations/vyra. Nenhum cadastro público, nenhum login social,
 * nenhum uso do cliente gerado pelo Lovable Cloud.
 *
 * Dois fluxos estritamente separados e nunca misturados:
 *  - Sessão real (kind "supabase"): Supabase Auth + perfil/cargo/permissões
 *    lidos de tabelas protegidas.
 *  - Sessão de demonstração (kind "demo"): só existe quando
 *    VITE_KIRVRA_DEMO_MODE === "true"; local, explícita, nada é gravado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { getVyraClient, isVyraConfigured } from "@/integrations/vyra/client";
import {
  ACCESS_DENIAL_MESSAGE,
  type AccessDenialReason,
  type CentralAccess,
  type PermissionCode,
} from "@/integrations/vyra/access";
import type { CentralEmployee, EmployeeRole } from "@/integrations/vyra/types";
import {
  completeFirstAccessOnServer,
  employeeInitials,
  loadCentralAccess,
  logCentralEvent,
} from "./central-access-service";
import { isDemoModeEnabled } from "./demo-mode";

export type CentralSessionKind = "supabase" | "demo";

export interface CentralSession {
  kind: CentralSessionKind;
  /** true somente quando a sessão veio do Supabase VYRA2. */
  backed: boolean;
  userId: string;
  role: EmployeeRole;
  permissions: PermissionCode[];
  employee: CentralEmployee;
  firstAccessPending: boolean;
  startedAt: string;
}

export type SignInResult =
  | { status: "ok"; session: CentralSession }
  | { status: "first_access"; session: CentralSession }
  | { status: "error"; message: string };

const DEMO_STORAGE_KEY = "kirvra-central-demo-session";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;

const DEMO_PERMISSIONS: PermissionCode[] = [
  "dashboard.view",
  "sessions.view",
  "location.view",
  "alerts.view",
  "alerts.handle",
  "alerts.take",
  "alerts.close",
  "evidence.view",
  "evidence.audio",
  "evidence.image",
  "drivers.view",
  "vehicles.view",
  "reports.view",
  "health.view",
];

let session: CentralSession | null = null;
let resolving: Promise<CentralSession | null> | null = null;
const listeners = new Set<(s: CentralSession | null) => void>();

let failedAttempts = 0;
let lockedUntil = 0;
let lastAccessError: string | null = null;

function notify() {
  listeners.forEach((listener) => listener(session));
}

function setSession(next: CentralSession | null) {
  session = next;
  notify();
}

/** Último motivo técnico de negação/erro, para exibição na tela de login. */
export function getLastAccessError(): string | null {
  return lastAccessError;
}

/* ------------------------------------------------------------------ */
/* Demonstração                                                        */
/* ------------------------------------------------------------------ */

function clearDemoStorage() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEMO_STORAGE_KEY);
}

export function isDemoAvailable(): boolean {
  return isDemoModeEnabled();
}

export function isDemoSession(value: CentralSession | null): boolean {
  return value?.kind === "demo";
}

function buildDemoSession(): CentralSession {
  return {
    kind: "demo",
    backed: false,
    userId: "demo-operator",
    role: "supervisor",
    permissions: DEMO_PERMISSIONS,
    employee: {
      id: "demo-operator",
      employeeCode: "KRV-DEMO",
      fullName: "Operador Demonstração",
      initials: "OD",
      role: "supervisor",
      online: true,
      firstAccessCompleted: true,
      lastSeenAt: new Date().toISOString(),
    },
    firstAccessPending: false,
    startedAt: new Date().toISOString(),
  };
}

function readDemoSession(): CentralSession | null {
  if (typeof window === "undefined") return null;
  if (!isDemoModeEnabled()) {
    clearDemoStorage();
    return null;
  }
  return window.localStorage.getItem(DEMO_STORAGE_KEY) === "1" ? buildDemoSession() : null;
}

/** Inicia, de forma explícita, uma sessão local de demonstração. */
export function startDemoSession(): CentralSession | null {
  if (!isDemoModeEnabled()) return null;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(DEMO_STORAGE_KEY, "1");
  }
  const demo = buildDemoSession();
  setSession(demo);
  return demo;
}

/* ------------------------------------------------------------------ */
/* Sessão real                                                         */
/* ------------------------------------------------------------------ */

function employeeFromAccess(access: CentralAccess): CentralEmployee {
  return {
    id: access.profile.id,
    employeeCode: access.profile.employeeCode || "—",
    fullName: access.profile.fullName,
    initials: employeeInitials(access.profile.fullName),
    role: access.role,
    online: true,
    firstAccessCompleted: !access.profile.primeiroAcesso,
    lastSeenAt: access.profile.lastAccessAt,
  };
}

function sessionFromAccess(access: CentralAccess): CentralSession {
  return {
    kind: "supabase",
    backed: true,
    userId: access.profile.id,
    role: access.role,
    permissions: access.permissions,
    employee: employeeFromAccess(access),
    firstAccessPending: access.profile.primeiroAcesso,
    startedAt: new Date().toISOString(),
  };
}

/**
 * Autentica a sessão do Supabase contra as tabelas internas da Central.
 * Qualquer negação encerra a sessão: um usuário do app do motorista jamais
 * acessa a Central automaticamente.
 */
async function authorizeSession(
  client: SupabaseClient,
  userId: string,
): Promise<{ session: CentralSession } | { error: string }> {
  const result = await loadCentralAccess(client, userId);

  if (result.status === "denied") {
    await client.auth.signOut();
    return { error: ACCESS_DENIAL_MESSAGE[result.reason as AccessDenialReason] };
  }
  if (result.status === "error") {
    await client.auth.signOut();
    return { error: result.message };
  }
  return { session: sessionFromAccess(result.access) };
}

async function resolveRealSession(): Promise<CentralSession | null> {
  const client = getVyraClient();
  if (!client) return null;

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;

  const outcome = await authorizeSession(client, data.user.id);
  if ("error" in outcome) {
    lastAccessError = outcome.error;
    return null;
  }
  lastAccessError = null;
  return outcome.session;
}

/**
 * Resolve a sessão vigente. Reutiliza uma única Promise para evitar
 * hidratações concorrentes. Nunca mistura demo e real.
 */
export function resolveCentralSession(): Promise<CentralSession | null> {
  if (resolving) return resolving;
  resolving = (async () => {
    const demo = readDemoSession();
    if (demo) {
      setSession(demo);
      return demo;
    }
    const real = await resolveRealSession();
    setSession(real);
    return real;
  })().finally(() => {
    resolving = null;
  });
  return resolving;
}

export function getSession(): CentralSession | null {
  return session;
}

export function subscribeSession(listener: (s: CentralSession | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isBackendAvailable(): boolean {
  return isVyraConfigured();
}

export function remainingLockSeconds(): number {
  const diff = lockedUntil - Date.now();
  return diff > 0 ? Math.ceil(diff / 1000) : 0;
}

export function hasPermission(value: CentralSession | null, permission: PermissionCode): boolean {
  return Boolean(value?.permissions.includes(permission));
}

export function hasAllPermissions(
  value: CentralSession | null,
  permissions: PermissionCode[],
): boolean {
  return permissions.every((permission) => hasPermission(value, permission));
}

/**
 * Identificação interna → e-mail de autenticação.
 * O funcionário pode informar o e-mail corporativo diretamente ou o ID interno
 * (KRV-0000), que é convertido pelo domínio interno da Central.
 */
export function loginIdentifierToEmail(identifier: string): string {
  const value = identifier.trim();
  if (value.includes("@")) return value.toLowerCase();
  return `${value.toLowerCase()}@central.kirvra.internal`;
}

export async function signIn(identifier: string, password: string): Promise<SignInResult> {
  if (remainingLockSeconds() > 0) {
    return {
      status: "error",
      message: `Muitas tentativas. Tente novamente em ${remainingLockSeconds()} s.`,
    };
  }
  if (!identifier.trim() || !password) {
    return {
      status: "error",
      message: "Informe a identificação interna (ou e-mail) e a senha.",
    };
  }

  const client = getVyraClient();
  if (!client) {
    return {
      status: "error",
      message:
        "Erro de configuração: o cliente Supabase VYRA2 não pôde ser inicializado corretamente.",
    };
  }

  let signInResponse;
  try {
    signInResponse = await client.auth.signInWithPassword({
      email: loginIdentifierToEmail(identifier),
      password,
    });
  } catch {
    return {
      status: "error",
      message: "Falha de conexão com o VYRA2. Verifique a rede e tente novamente.",
    };
  }

  const { data, error } = signInResponse;
  if (error || !data.user) {
    failedAttempts += 1;
    if (failedAttempts >= MAX_ATTEMPTS) {
      lockedUntil = Date.now() + LOCK_MS;
      failedAttempts = 0;
      return {
        status: "error",
        message: "Limite de tentativas atingido. Aguarde 60 s antes de tentar novamente.",
      };
    }
    return { status: "error", message: "Credenciais inválidas." };
  }
  failedAttempts = 0;

  const outcome = await authorizeSession(client, data.user.id);
  if ("error" in outcome) {
    lastAccessError = outcome.error;
    setSession(null);
    return { status: "error", message: outcome.error };
  }

  lastAccessError = null;
  clearDemoStorage();
  setSession(outcome.session);
  void logCentralEvent(client, {
    action: "auth.sign_in",
    entity: "central_profiles",
    entityId: outcome.session.userId,
  });

  return outcome.session.firstAccessPending
    ? { status: "first_access", session: outcome.session }
    : { status: "ok", session: outcome.session };
}

export function validatePasswordPolicy(value: string): string[] {
  const problems: string[] = [];
  if (value.length < 12) problems.push("Mínimo de 12 caracteres");
  if (!/[A-Za-zÀ-ÿ]/.test(value)) problems.push("Pelo menos uma letra");
  if (!/[0-9]/.test(value)) problems.push("Pelo menos um número");
  if (!/[^A-Za-z0-9À-ÿ]/.test(value)) problems.push("Pelo menos um caractere especial");
  return problems;
}

export type ServiceResult =
  { status: "ok" } | { status: "pending"; message: string } | { status: "error"; message: string };

/**
 * Conclui o primeiro acesso: troca real da senha + atualização de
 * central_profiles.primeiro_acesso + auditoria. Se qualquer etapa falhar,
 * nenhum sucesso é reportado.
 */
export async function completeFirstAccess(input: {
  newPassword: string;
  confirmPassword: string;
  acceptedTerms: boolean;
}): Promise<ServiceResult> {
  if (!input.acceptedTerms) {
    return {
      status: "error",
      message: "É necessário aceitar os termos internos de operação.",
    };
  }
  if (input.newPassword !== input.confirmPassword) {
    return { status: "error", message: "As senhas não coincidem." };
  }
  if (validatePasswordPolicy(input.newPassword).length > 0) {
    return {
      status: "error",
      message: "A nova senha não atende à política mínima.",
    };
  }

  const client = getVyraClient();
  if (!client) {
    return {
      status: "error",
      message: "Integração pendente: sem as credenciais do VYRA2 a senha não pode ser alterada.",
    };
  }

  const { data: userData } = await client.auth.getUser();
  if (!userData.user) {
    return { status: "error", message: "Sessão expirada. Entre novamente." };
  }

  const passwordUpdate = await client.auth.updateUser({
    password: input.newPassword,
  });
  if (passwordUpdate.error) {
    return {
      status: "error",
      message: passwordUpdate.error.message || "Não foi possível definir a nova senha.",
    };
  }

  const serverUpdate = await completeFirstAccessOnServer(client);
  if (!serverUpdate.ok) {
    return {
      status: "error",
      message:
        serverUpdate.message ??
        "Senha alterada, mas o perfil interno não pôde ser atualizado. Procure o supervisor.",
    };
  }

  const refreshed = await resolveRealSession();
  setSession(refreshed);
  return { status: "ok" };
}

export async function requestPasswordReset(identifier: string): Promise<ServiceResult> {
  if (!identifier.trim()) {
    return {
      status: "error",
      message: "Informe a identificação interna ou o e-mail corporativo.",
    };
  }
  const client = getVyraClient();
  if (!client) {
    return {
      status: "error",
      message: "Integração pendente: a redefinição exige as credenciais do VYRA2.",
    };
  }
  const { error } = await client.auth.resetPasswordForEmail(loginIdentifierToEmail(identifier));
  if (error) {
    return {
      status: "error",
      message: "Não foi possível registrar a solicitação de redefinição.",
    };
  }
  return {
    status: "pending",
    message:
      "Solicitação enviada ao e-mail corporativo cadastrado. Nenhuma senha é exibida na interface.",
  };
}

export async function signOut(): Promise<void> {
  const client = getVyraClient();
  if (client) {
    if (session?.backed) {
      void logCentralEvent(client, {
        action: "auth.sign_out",
        entity: "central_profiles",
        entityId: session.userId,
      });
    }
    await client.auth.signOut();
  }
  clearDemoStorage();
  lastAccessError = null;
  setSession(null);
}
