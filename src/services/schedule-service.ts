import { supabase } from "@/integrations/vyra/client";
import type { EmployeeRole } from "@/integrations/vyra/types";

export interface ScheduleOperator {
  id: string;
  fullName: string;
  role: EmployeeRole;
  status: "online" | "ocupado" | "offline";
  assignment: string | null;
  region: string | null;
}

export interface ScheduleMetrics {
  onlineCount: number;
  scaledTotal: number;
  availableCount: number;
  inProgressCount: number;
  criticalCount: number;
  coveredRegions: number;
  totalRegions: number;
}

export interface ScheduleData {
  status: "integrationPending" | "ready";
  metrics: ScheduleMetrics;
  operators: ScheduleOperator[];
}

/**
 * Serviço de escalas e presença operacional.
 * 
 * Atualmente o VYRA2 não possui infraestrutura de escalas, turnos ou heartbeat.
 * Este serviço identifica a ausência desses dados e retorna o estado de integração pendente.
 */
export async function getScheduleData(): Promise<ScheduleData> {
  try {
    // Tentamos buscar perfis reais para mostrar que a conexão VYRA2 está ativa,
    // mesmo que a lógica de escalas não exista.
    const { data: profiles, error } = await supabase
      .from("central_profiles")
      .select(`
        id,
        full_name,
        status,
        central_user_roles(
          central_roles(code)
        )
      `)
      .limit(20);

    if (error) throw error;

    // Retorna explicitamente que a integração de escalas está pendente.
    // Os indicadores serão zerados e a lista mostrará o aviso conforme solicitado.
    return {
      status: "integrationPending",
      metrics: {
        onlineCount: 0,
        scaledTotal: 0,
        availableCount: 0,
        inProgressCount: 0,
        criticalCount: 0,
        coveredRegions: 0,
        totalRegions: 0,
      },
      operators: [],
    };
  } catch (err) {
    console.error("Erro ao carregar dados de escalas:", err);
    return {
      status: "integrationPending",
      metrics: {
        onlineCount: 0,
        scaledTotal: 0,
        availableCount: 0,
        inProgressCount: 0,
        criticalCount: 0,
        coveredRegions: 0,
        totalRegions: 0,
      },
      operators: [],
    };
  }
}
