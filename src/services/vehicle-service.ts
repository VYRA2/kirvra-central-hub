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

export const listVehicles = async (filters: VehicleFilters) => {
  const supabase = getVyraClient();
  if (!supabase) throw new Error("Supabase client not configured");

  let query = supabase
    .from("vehicles")
    .select(`
      *,
      drivers:driver_id (
        full_name
      ),
      protection_sessions:protection_sessions!vehicle_id (
        started_at
      )
    `);

  // Filtros
  if (filters.status && filters.status !== "Todos os estados") {
    query = query.eq("verification_status", filters.status);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Busca textual no cliente por causa do join e flexibilidade (Placa, Marca, Modelo, Cor, Motorista)
  let processed = (data || []).map((v: any) => {
    // Pegar a sessão mais recente
    const sessions = v.protection_sessions || [];
    const lastSession = sessions.length > 0 
      ? sessions.sort((a: any, b: any) => 
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        )[0].started_at 
      : null;

    return {
      ...v,
      driver_full_name: v.drivers?.full_name || null,
      last_session_started_at: lastSession,
    };
  });

  if (filters.search) {
    const s = filters.search.toLowerCase();
    processed = processed.filter((v: any) => 
      (v.plate?.toLowerCase().includes(s)) ||
      (v.brand?.toLowerCase().includes(s)) ||
      (v.model?.toLowerCase().includes(s)) ||
      (v.color?.toLowerCase().includes(s)) ||
      (v.driver_full_name?.toLowerCase().includes(s))
    );
  }

  return processed as VehicleRow[];
};

export const formatRelativeSessionDate = (dateStr: string | null) => {
  if (!dateStr) return "Nenhuma sessão";
  
  const date = new Date(dateStr);
  const now = new Date();
  
  // "Agora" se for nos últimos 2 minutos
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

  const rows = vehicles.map((v) => [
    `${v.brand || ""} ${v.model || ""} ${v.year || ""}`.trim(),
    v.plate,
    v.driver_full_name || "Não informado",
    v.owner_type === "self" ? "Próprio" : v.owner_type === "third_party" ? "Terceiro" : "Não informado",
    v.verification_status || "Pendente",
    v.last_session_started_at ? new Date(v.last_session_started_at).toLocaleString("pt-BR") : "Nenhuma",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((r) => r.map(cell => `"${cell}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `veiculos_kirvra_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
