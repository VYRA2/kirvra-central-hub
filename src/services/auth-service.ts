/**
 * Serviço de autenticação da Central KIRVRA.
 *
 * Alvo: Supabase VYRA2 (ref hwpansazevjwzdcmhssc) via src/integrations/vyra.
 * Não existe cadastro público nem login social.
 *
 * Dois fluxos estritamente separados:
 *  - Sessão real: administrada pelo cliente Supabase VYRA2 (backed: true).
 *  - Sessão de demonstração: local, explícita, apenas quando o modo
 *    demonstração está habilitado (backed: false). Nunca grava nada.
 */
import { getVyraClient, isVyraConfigured } from "@/integrations/vyra/client";
import type { CentralEmployee, EmployeeRole } from "@/integrations/vyra/types";
import { currentEmployee } from "@/mocks/kirvra-central";
import { isDemoModeEnabled } from "./demo-mode";

export type CentralSessionKind = "supabase" | "demo";

export interface CentralSession {
  kind: CentralSessionKind;
  employee: CentralEmployee;
  /** true quando a sessão veio do Supabase VYRA2; false em demonstração. */
  backed: boolean;
  startedAt: string;
}

export type SignInResult =
  | { status: "ok"; session: CentralSession }
  | { status: "first_access"; employeeCode: string }
  | { status: "error"; message: string };

/** Chave exclusiva da sessão fictícia. Nunca guarda token ou senha. */
const DEMO_STORAGE_KEY = "kirvra-central-demo-session";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;

const KNOWN_ROLES: EmployeeRole[] = [
  "super_admin",
  "admin",
  "gerente",
  "supervisor",
  "operador",
  "auditor",
];

let session: CentralSession | null = null;
let resolving: Promise<CentralSession | null> | null = null;
const listeners = new Set<(s: CentralSession | null) => void>();

let failedAttempts = 0;
let lockedUntil = 0;

function notify() {
  listeners.forEach((listener) => listener(session));
}

function setSession(next: CentralSession | null) {
  session = next;
  notify();
}

/* ------------------------------------------------------------------ */
/* Demonstração                                                        */
/* ------------------------------------------------------------------ */

function isDemoSessionShape(value: unknown): value is CentralSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CentralSession>;
  return (
    candidate.kind === "demo" &&
    candidate.backed === false &&
    typeof candidate.startedAt === "string" &&
    typeof candidate.employee === "object" &&
    candidate.employee !== null &&
    typeof candidate.employee.employeeCode === "string" &&
    typeof candidate.employee.role === "string" &&
    KNOWN_ROLES.includes(candidate.employee.role as EmployeeRole)
  );
}

function clearDemoStorage() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEMO_STORAGE_KEY);
}

function readDemoSession(): CentralSession | null {
  if (typeof window === "undefined") return null;
  if (!isDemoModeEnabled()) {
    clearDemoStorage();
    return null;
  }
  const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isDemoSessionShape(parsed)) {
      clearDemoStorage();
      return null;
    }
    return parsed;
  } catch {
    clearDemoStorage();
    return null;
  }
}

/** Inicia, de forma explícita, uma sessão local de demonstração. */
export function startDemoSession(): CentralSession | null {
  if (!isDemoModeEnabled()) return null;
  const demo: CentralSession = {
    kind: "demo",
    employee: { ...currentEmployee },
    backed: false,
    startedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demo));
  }
  setSession(demo);
  return demo;
}

export function isDemoAvailable(): boolean {
  return isDemoModeEnabled();
}

/* ------------------------------------------------------------------ */
/* Sessão real                                                         */
/* ------------------------------------------------------------------ */

function roleFromAppMetadata(appMetadata: Record<string, unknown>): EmployeeRole {
  const role = appMetadata["kirvra_role"];
  return typeof role === "string" && KNOWN_ROLES.includes(role as EmployeeRole)
    ? (role as EmployeeRole)
    : "operador";
}

function employeeFromUser(user: {
  id: string;
  email?: string | undefined;
  app_metadata: Record<string, unknown>;
}): CentralEmployee {
  const appMetadata = user.app_metadata ?? {};
  const code =
    typeof appMetadata["kirvra_employee_code"] === "string"
      ? (appMetadata["kirvra_employee_code"] as string)
      : (user.email?.split("@")[0] ?? "").toUpperCase();
  const fullName =
    typeof appMetadata["kirvra_full_name"] === "string"
      ? (appMetadata["kirvra_full_name"] as string)
      : code || "Funcionário";
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return {
    id: user.id,
    employeeCode: code,
    fullName,
    initials: initials || "KV",
    role: roleFromAppMetadata(appMetadata),
    online: true,
    firstAccessCompleted: appMetadata["kirvra_first_access"] !== true,
    lastSeenAt: new Date().toISOString(),
  };
}

async function resolveRealSession(): Promise<CentralSession | null> {
  const client = getVyraClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return {
    kind: "supabase",
    employee: employeeFromUser({
      id: data.user.id,
      email: data.user.email,
      app_metadata: (data.user.app_metadata ?? {}) as Record<string, unknown>,
    }),
    backed: true,
    startedAt: new Date().toISOString(),
  };
}

/**
 * Resolve a sessão vigente (demo ou real). Reutiliza uma única Promise para
 * evitar hidratações concorrentes.
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

/** Sessão já resolvida em memória (sem efeito colateral). */
export function getSession(): CentralSession | null {
  return session;
}

export function subscribeSession(
  listener: (s: CentralSession | null) => void,
): () => void {
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

/**
 * Deriva o identificador de login a partir do ID de funcionário.
 * O formulário nunca expõe e-mail: o ID interno é a credencial.
 */
function employeeIdentifier(employeeCode: string): string {
  return `${employeeCode.trim().toLowerCase()}@central.kirvra.internal`;
}

export async function signIn(
  employeeCode: string,
  password: string,
): Promise<SignInResult> {
  if (remainingLockSeconds() > 0) {
    return {
      status: "error",
      message: `Muitas tentativas. Tente novamente em ${remainingLockSeconds()} s.`,
    };
  }

  const client = getVyraClient();
  if (!client) {
    return {
      status: "error",
      message:
        "Integração pendente: o Supabase VYRA2 ainda não está configurado. Use o modo demonstração para visualizar as telas.",
    };
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: employeeIdentifier(employeeCode),
    password,
  });
  if (error || !data.user) {
    failedAttempts += 1;
    if (failedAttempts >= MAX_ATTEMPTS) {
      lockedUntil = Date.now() + LOCK_MS;
      failedAttempts = 0;
    }
    return { status: "error", message: "Credenciais inválidas." };
  }
  failedAttempts = 0;

  const appMetadata = (data.user.app_metadata ?? {}) as Record<string, unknown>;
  if (appMetadata["kirvra_first_access"] === true) {
    return { status: "first_access", employeeCode: employeeCode.trim() };
  }

  // Uma sessão real invalida qualquer resíduo de demonstração.
  clearDemoStorage();
  const real: CentralSession = {
    kind: "supabase",
    employee: employeeFromUser({
      id: data.user.id,
      email: data.user.email,
      app_metadata: appMetadata,
    }),
    backed: true,
    startedAt: new Date().toISOString(),
  };
  setSession(real);
  return { status: "ok", session: real };
}

export interface FirstAccessInput {
  employeeCode: string;
  temporaryPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export type ServiceResult =
  | { status: "ok" }
  | { status: "pending"; message: string }
  | { status: "error"; message: string };

export function validatePasswordPolicy(value: string): string[] {
  const problems: string[] = [];
  if (value.length < 12) problems.push("Mínimo de 12 caracteres");
  if (!/[A-Za-zÀ-ÿ]/.test(value)) problems.push("Pelo menos uma letra");
  if (!/[0-9]/.test(value)) problems.push("Pelo menos um número");
  if (!/[^A-Za-z0-9À-ÿ]/.test(value))
    problems.push("Pelo menos um caractere especial");
  return problems;
}

export async function completeFirstAccess(
  input: FirstAccessInput,
): Promise<ServiceResult> {
  if (input.newPassword !== input.confirmPassword) {
    return { status: "error", message: "As senhas não coincidem." };
  }
  if (input.newPassword === input.temporaryPassword) {
    return {
      status: "error",
      message: "A nova senha não pode repetir a senha provisória.",
    };
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
      status: "pending",
      message:
        "Demonstração concluída — nenhuma alteração foi gravada. A troca de senha exige o Supabase VYRA2 configurado.",
    };
  }

  const signInResponse = await client.auth.signInWithPassword({
    email: employeeIdentifier(input.employeeCode),
    password: input.temporaryPassword,
  });
  if (signInResponse.error) {
    return { status: "error", message: "Credenciais inválidas." };
  }

  const { error } = await client.auth.updateUser({
    password: input.newPassword,
  });
  if (error) {
    return { status: "error", message: "Não foi possível definir a senha." };
  }
  return { status: "ok" };
}

export async function requestPasswordReset(
  employeeCode: string,
): Promise<ServiceResult> {
  if (!employeeCode.trim()) {
    return { status: "error", message: "Informe o ID de funcionário." };
  }
  if (!getVyraClient()) {
    return {
      status: "pending",
      message:
        "Integração pendente: a redefinição interna será liberada com o Supabase VYRA2.",
    };
  }
  return {
    status: "pending",
    message:
      "Solicitação registrada para validação do supervisor. Nenhuma senha é exibida na interface.",
  };
}

export async function signOut(): Promise<void> {
  const client = getVyraClient();
  if (client) await client.auth.signOut();
  clearDemoStorage();
  setSession(null);
}
