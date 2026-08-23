import { getVyraClient } from "@/integrations/vyra/client";

export interface AuditRow {
  id: string;
  operator_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  previous_data: any;
  next_data: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  // Join
  operator_name?: string | null;
  operator_code?: string | null;
}

export interface AuditFilters {
  search: string;
  operator_id: string | "todos";
  action: string | "todos";
  entity_type: string | "todos";
  period: string | "24"; // horas
  page: number;
  pageSize: number;
}

export const DEFAULT_AUDIT_FILTERS: AuditFilters = {
  search: "",
  operator_id: "todos",
  action: "todos",
  entity_type: "todos",
  period: "24",
  page: 1,
  pageSize: 25,
};

export async function listAuditLogs(filters: AuditFilters) {
  const client = getVyraClient();
  if (!client) throw new Error("VYRA client not configured");

  let query = client
    .from("central_audit_logs")
    .select(`
      *,
      operator:central_profiles!operator_id(full_name, employee_code)
    `, { count: "exact" });

  if (filters.operator_id !== "todos") {
    query = query.eq("operator_id", filters.operator_id);
  }

  if (filters.action !== "todos") {
    query = query.eq("action", filters.action);
  }

  if (filters.entity_type !== "todos") {
    query = query.eq("entity_type", filters.entity_type);
  }

  if (filters.search) {
    query = query.or(`action.ilike.%${filters.search}%,entity_type.ilike.%${filters.search}%,entity_id.ilike.%${filters.search}%`);
  }

  // Filtro de período simplificado (últimas N horas)
  const since = new Date(Date.now() - parseInt(filters.period) * 60 * 60 * 1000).toISOString();
  query = query.gte("created_at", since);

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  const rows: AuditRow[] = (data || []).map((row: any) => ({
    ...row,
    operator_name: row.operator?.full_name,
    operator_code: row.operator?.employee_code,
  }));

  return { rows, count: count || 0 };
}

export async function getAuditStats() {
  const client = getVyraClient();
  if (!client) return null;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, recentRes, operatorsRes] = await Promise.all([
    client.from("central_audit_logs").select("*", { count: "exact", head: true }),
    client.from("central_audit_logs").select("*", { count: "exact", head: true }).gte("created_at", since24h),
    client.from("central_audit_logs").select("operator_id"), // Para contar únicos no JS ou via RPC
  ]);

  const uniqueOperators = new Set((operatorsRes.data || []).map((r: any) => r.operator_id)).size;

  return {
    total: totalRes.count || 0,
    recent24h: recentRes.count || 0,
    uniqueOperators,
  };
}
