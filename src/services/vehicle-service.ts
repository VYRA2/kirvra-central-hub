import { getVyraClient } from "@/integrations/vyra/client";
import { Database } from "@/integrations/vyra/types";
import { formatDistanceToNow, isAfter, subMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";

export type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"] & {
  driver_full_name: string | null;
  last_session_started_at: string | null;
};

export interface VehicleFilters {
  search: string;
  status: string;
}

export const listVehicles = async (filters: VehicleFilters): Promise<VehicleRow[]> => {
  const supabase = getVyraClient();
  if (!supabase) throw new Error("Supabase client not configured");

  // Efficient query to get vehicles with their drivers and ONLY the latest session
  // We use a subquery approach via the client if possible, but standard selection is fine
  // since RLS will filter. To be truly efficient, we use a specialized query.
  let query = supabase
    .from("vehicles")
    .select(`
      *,
      drivers (
        full_name
      ),
      protection_sessions (
        started_at
      )
    `)
    .order('started_at', { foreignTable: 'protection_sessions', ascending: false })
    .limit(1, { foreignTable: 'protection_sessions' });

  if (filters.status && filters.status !== "Todos os estados") {
    query = query.eq("verification_status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;

  let processed = (data || []).map((v) => {
    // With limit(1), protection_sessions should be an array of at most 1 element
    const lastSession = v.protection_sessions && v.protection_sessions.length > 0 
      ? v.protection_sessions[0].started_at 
      : null;

    const driverData = v.drivers as any;

    return {
      ...v,
      driver_full_name: driverData?.full_name || null,
      last_session_started_at: lastSession,
    } as VehicleRow;
  });

  if (filters.search) {
    const s = filters.search.toLowerCase();
    processed = processed.filter((v) => 
      (v.plate?.toLowerCase().includes(s)) ||
      (v.brand?.toLowerCase().includes(s)) ||
      (v.model?.toLowerCase().includes(s)) ||
      (v.color?.toLowerCase().includes(s)) ||
      (v.driver_full_name?.toLowerCase().includes(s))
    );
  }

  return processed;
};

export const getVehicleById = async (id: string): Promise<VehicleRow | null> => {
  const supabase = getVyraClient();
  if (!supabase) throw new Error("Supabase client not configured");

  const { data, error } = await supabase
    .from("vehicles")
    .select(`
      *,
      drivers (
        full_name
      ),
      protection_sessions (
        started_at
      )
    `)
    .eq("id", id)
    .order('started_at', { foreignTable: 'protection_sessions', ascending: false })
    .limit(1, { foreignTable: 'protection_sessions' })
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  const driverData = data.drivers as any;
  const lastSession = data.protection_sessions && data.protection_sessions.length > 0 
    ? data.protection_sessions[0].started_at 
    : null;

  return {
    ...data,
    driver_full_name: driverData?.full_name || null,
    last_session_started_at: lastSession,
  } as VehicleRow;
};

export const formatRelativeSessionDate = (dateStr: string | null) => {
  if (!dateStr) return "Nenhuma sessão";
  
  const date = new Date(dateStr);
  const now = new Date();
  
  if (isAfter(date, subMinutes(now, 2))) return "Agora";
  
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR })
    .replace("em ", "")
    .replace("cerca de ", "")
    .replace("há ", "Há ");
};

export const exportVehiclesToCSV = (vehicles: VehicleRow[]) => {
  const headers = [
    "Veículo",
    "Placa",
    "Motorista",
    "Propriedade",
    "Documento",
    "Última sessão",
  ];

  // Properly escape CSV fields
  const escapeCsv = (val: string | null | number | undefined) => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = vehicles.map((v) => [
    escapeCsv(`${v.brand || ""} ${v.model || ""} ${v.year || ""}`.trim()),
    escapeCsv(v.plate),
    escapeCsv(v.driver_full_name || "Não informado"),
    escapeCsv(v.owner_type === "self" ? "Próprio" : v.owner_type === "third_party" ? "Terceiro" : "Não informado"),
    escapeCsv(v.verification_status || "Pendente"),
    escapeCsv(v.last_session_started_at ? new Date(v.last_session_started_at).toLocaleString("pt-BR") : "Nenhuma"),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `veiculos_kirvra_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Liberar a URL
  setTimeout(() => URL.revokeObjectURL(url), 100);
};