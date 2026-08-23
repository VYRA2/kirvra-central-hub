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
    .select(`*`, { count: "exact" });

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
    if (filters.search.length === 36 && filters.search.includes("-")) {
      query = query.or(`id.eq.${filters.search},entity_id.eq.${filters.search},operator_id.eq.${filters.search}`);
    } else {
      // Busca segura: Apenas em campos de texto direto
      query = query.or(`action.ilike.%${filters.search}%,entity_type.ilike.%${filters.search}%`);
      
      // Se precisarmos buscar por nome do operador, teríamos que:
      // 1. Buscar IDs de perfis que batem com o nome
      // 2. Adicionar .in('operator_id', matchingIds)
      // Para esta correção cirúrgica, focaremos em action e entity_type no or direto
    }
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

  const operatorIds = [...new Set(data.map((r: any) => r.operator_id).filter(Boolean))];
  let profilesMap = new Map<string, { full_name: string; employee_code: string }>();

  if (operatorIds.length > 0) {
    const { data: profiles } = await client
      .from("central_profiles")
      .select("id, full_name, employee_code")
      .in("id", operatorIds);
    
    if (profiles) {
      profiles.forEach(p => profilesMap.set(p.id, { full_name: p.full_name, employee_code: p.employee_code }));
    }
  }

  const rows: AuditRow[] = (data || []).map((row: any) => {
    const profile = profilesMap.get(row.operator_id);
    return {
      ...row,
      operator_name: profile?.full_name,
      operator_code: profile?.employee_code,
    };
  });

  return { rows, count: count || 0 };
}

export async function getAuditStats() {
  const client = getVyraClient();
  if (!client) return null;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, recentRes, operatorsRes] = await Promise.all([
    client.from("central_audit_logs").select("*", { count: "exact", head: true }),
    client.from("central_audit_logs").select("*", { count: "exact", head: true }).gte("created_at", since24h),
    client.from("central_audit_logs").select("operator_id"),
  ]);

  const uniqueOperatorIds = new Set((operatorsRes.data || []).map((r: any) => r.operator_id).filter(Boolean));
  const uniqueOperatorsCount = uniqueOperatorIds.size;

  return {
    total: totalRes.count || 0,
    recent24h: recentRes.count || 0,
    uniqueOperators: uniqueOperatorsCount,
  };
}
