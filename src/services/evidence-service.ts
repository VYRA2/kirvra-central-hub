import { getVyraClient } from "@/integrations/vyra/client";
import { readIso, readNumber, readString } from "@/integrations/vyra/live";

export interface EvidenceRow {
  id: string;
  alert_id: string | null;
  security_alert_id: string | null;
  session_id: string | null;
  driver_id: string | null;
  evidence_type: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  sha256: string | null;
  metadata: Record<string, any> | null;
  captured_at: string | null;
  created_at: string | null;
  // Joins
  driver_name?: string | null;
  session_label?: string | null;
  alert_protocol?: string | null;
  alert_origin?: "IA" | "Comum";
}

export interface EvidenceFilters {
  search: string;
  type: string | "todos";
  origin: string | "todos";
  period: string | "30"; // dias
  page: number;
  pageSize: number;
}

export const DEFAULT_EVIDENCE_FILTERS: EvidenceFilters = {
  search: "",
  type: "todos",
  origin: "todos",
  period: "30",
  page: 1,
  pageSize: 20,
};

export async function listEvidence(filters: EvidenceFilters) {
  const client = getVyraClient();
  if (!client) throw new Error("VYRA client not configured");

  let query = client
    .from("alert_evidence")
    .select(`
      *,
      drivers(full_name),
      protection_sessions(started_at),
      alerts(protocol),
      security_alerts(id)
    `, { count: "exact" });

  if (filters.type !== "todos") {
    query = query.eq("evidence_type", filters.type);
  }

  if (filters.origin === "IA") {
    query = query.not("security_alert_id", "is", null);
  } else if (filters.origin === "Comum") {
    query = query.is("security_alert_id", null);
  }

  if (filters.search) {
    // Busca simplificada por ID ou driver_id (PostgREST limitations)
    // Em produção, isso seria um search RPC ou FTS
    query = query.or(`id.ilike.%${filters.search}%,driver_id.ilike.%${filters.search}%`);
  }

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;

  const { data, count, error } = await query
    .order("captured_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  const rows: EvidenceRow[] = (data || []).map((row: any) => ({
    id: row.id,
    alert_id: row.alert_id,
    security_alert_id: row.security_alert_id,
    session_id: row.session_id,
    driver_id: row.driver_id,
    evidence_type: row.evidence_type,
    storage_bucket: row.storage_bucket,
    storage_path: row.storage_path,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    sha256: row.sha256,
    metadata: row.metadata,
    captured_at: row.captured_at,
    created_at: row.created_at,
    driver_name: row.drivers?.full_name,
    session_label: row.protection_sessions?.started_at ? `Sessão ${new Date(row.protection_sessions.started_at).toLocaleDateString()}` : null,
    alert_protocol: row.alerts?.protocol,
    alert_origin: row.security_alert_id ? "IA" : "Comum",
  }));

  return { rows, count: count || 0 };
}

export async function getEvidenceSignedUrl(bucket: string, path: string) {
  const client = getVyraClient();
  if (!client) return null;

  const { data, error } = await client.storage
    .from(bucket || "alert-evidence")
    .createSignedUrl(path, 300); // 5 minutos

  if (error) return null;
  return data.signedUrl;
}
