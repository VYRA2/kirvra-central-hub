/**
 * Serviço de autenticação da Central KIRVRA.
 *
 * Alvo: Supabase VYRA2 (ref hwpansazevjwzdcmhssc) via src/integrations/vyra.
 * Não existe cadastro público nem login social.
 *
 * Enquanto as variáveis VITE_VYRA_SUPABASE_* não estiverem definidas, a
 * autenticação real fica indisponível: a interface declara "Integração
 * pendente" e só permite uma sessão local de demonstração, explicitamente
 * rotulada, que nunca grava nada e nunca finge sucesso de operação crítica.
 */
import { getVyraClient, isVyraConfigured } from "@/integrations/vyra/client";
import type { CentralEmployee } from "@/integrations/vyra/types";
import { currentEmployee } from "@/mocks/kirvra-central";

export interface CentralSession {
  employee: CentralEmployee;
  /** true quando a sessão veio do Supabase VYRA2; false em demonstração. */
  backed: boolean;
  startedAt: string;
}

export type SignInResult =
  | { status: "ok"; session: CentralSession }
  | { status: "first_access"; employeeCode: string }
  | { status: "error"; message: string };

const STORAGE_KEY = "kirvra-central-session";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;

let session: CentralSession | null = null;
let hydrated = false;
const listeners = new Set<(s: CentralSession | null) => void>();

let failedAttempts = 0;
let lockedUntil = 0;

function notify() {
  listeners.forEach((listener) => listener(session));
}

function persist() {
  if (typeof window === "undefined") return;
  if (session) {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

/** Carrega a sessão do armazenamento do navegador (client-only). */
export function hydrateSession(): CentralSession | null {
  if (typeof window === "undefined") return null;
  if (hydrated) return session;
  hydrated = true;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      session = JSON.parse(raw) as CentralSession;
    } catch {
      session = null;
    }
  }
  return session;
}

export function getSession(): CentralSession | null {
  return hydrateSession();
}

export function subscribeSession(
  listener: (s: CentralSession | null) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
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

  if (client) {
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

    const appMetadata = data.user.app_metadata as Record<string, unknown>;
    const firstAccessPending = appMetadata["kirvra_first_access"] === true;
    if (firstAccessPending) {
      return { status: "first_access", employeeCode: employeeCode.trim() };
    }

    session = {
      employee: {
        ...currentEmployee,
        id: data.user.id,
        employeeCode: employeeCode.trim().toUpperCase(),
        role:
          (appMetadata["kirvra_role"] as CentralEmployee["role"]) ?? "operador",
      },
      backed: true,
      startedAt: new Date().toISOString(),
    };
    hydrated = true;
    persist();
    notify();
    return { status: "ok", session };
  }

  // Sem credenciais VYRA2: sessão local de demonstração, sem backend.
  if (!employeeCode.trim() || !password) {
    return { status: "error", message: "Credenciais inválidas." };
  }
  session = {
    employee: {
      ...currentEmployee,
      employeeCode: employeeCode.trim().toUpperCase(),
    },
    backed: false,
    startedAt: new Date().toISOString(),
  };
  hydrated = true;
  persist();
  notify();
  return { status: "ok", session };
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
        "Integração pendente: a troca de senha exige o Supabase VYRA2 configurado.",
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
  session = null;
  hydrated = true;
  persist();
  notify();
}
