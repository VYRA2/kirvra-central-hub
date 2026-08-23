/**
 * Consultas reais às tabelas EXISTENTES do Supabase VYRA2.
 *
 * Nenhuma tabela é criada aqui e nenhum dado é inventado. Como o inventário de
 * colunas do VYRA2 não pôde ser lido neste ambiente (credenciais ausentes), a
 * leitura usa `select('*')` e os campos são resolvidos por nomes candidatos em
 * src/integrations/vyra/live.ts. Campos ausentes ficam nulos e a interface
 * mostra estado vazio.
 */
import { getVyraClient } from "@/integrations/vyra/client";
import {
  joinSessionContext,
  normalizeAlert,
  normalizeDriver,
  normalizeSession,
  normalizeVehicle,
  type LiveAlert,
  type LiveSession,
} from "@/integrations/vyra/live";

export type VyraDataErrorCode =
  | "not_configured"
  | "missing_table"
  | "denied"
  | "unknown";

export class VyraDataError extends Error {
  readonly code: VyraDataErrorCode;
  constructor(code: VyraDataErrorCode, message: string) {
    super(message);
    this.name = "VyraDataError";
    this.code = code;
  }
}

function classify(error: { code?: string; message?: string }): VyraDataError {
  const code = error.code ?? "";
  if (code === "42P01" || code === "PGRST205") {
    return new VyraDataError(
      "missing_table",
      "Tabela ausente no VYRA2 para esta consulta.",
    );
  }
  if (code === "42501" || code === "PGRST301") {
    return new VyraDataError(
      "denied",
      "Sem permissão de leitura para estes dados no VYRA2.",
    );
  }
  return new VyraDataError(
    "unknown",
    "Falha ao consultar os dados operacionais do VYRA2.",
  );
}

async function selectAll(
  table: string,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const client = getVyraClient();
  if (!client) {
    throw new VyraDataError(
      "not_configured",
      "Integração pendente: credenciais do VYRA2 ausentes.",
    );
  }
  const { data, error } = await client.from(table).select("*").limit(limit);
  if (error) throw classify(error);
  return (data ?? []) as Record<string, unknown>[];
}

export interface LiveContext {
  sessions: LiveSession[];
  alerts: LiveAlert[];
  updatedAt: string;
}

/** Contexto operacional ao vivo: sessões ativas + alertas + join local. */
export async function fetchLiveContext(): Promise<LiveContext> {
  const [sessionRows, alertRows, driverRows, vehicleRows] = await Promise.all([
    selectAll("protection_sessions", 500),
    selectAll("alerts", 300),
    selectAll("drivers", 1000),
    selectAll("vehicles", 1000),
  ]);

  const alerts = alertRows
    .map(normalizeAlert)
    .filter((alert): alert is LiveAlert => alert !== null);
  const drivers = driverRows
    .map(normalizeDriver)
    .filter((driver): driver is NonNullable<typeof driver> => driver !== null);
  const vehicles = vehicleRows
    .map(normalizeVehicle)
    .filter((vehicle): vehicle is NonNullable<typeof vehicle> => vehicle !== null);

  const sessions = joinSessionContext(
    sessionRows
      .map(normalizeSession)
      .filter((session): session is LiveSession => session !== null)
      .filter((session) => session.state !== "encerrada" && !session.endedAt),
    drivers,
    vehicles,
    alerts,
  );

  const driverById = new Map(drivers.map((driver) => [driver.id, driver]));

  return {
    sessions,
    alerts: alerts.map((alert) => ({
      ...alert,
      driverName: alert.driverId
        ? (driverById.get(alert.driverId)?.name ?? null)
        : null,
    })),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * URL assinada de curta duração para evidências privadas do bucket
 * `alert-evidence`. O bucket NUNCA é tornado público.
 */
export async function createEvidenceSignedUrl(
  path: string,
  expiresInSeconds = 120,
): Promise<string | null> {
  const client = getVyraClient();
  if (!client || !path) return null;
  const { data, error } = await client.storage
    .from("alert-evidence")
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
