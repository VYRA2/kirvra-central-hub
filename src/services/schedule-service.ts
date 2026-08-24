import { getVyraClient } from "@/integrations/vyra/client";
import type { EmployeeRole } from "@/integrations/vyra/types";

export const HEARTBEAT_TIMEOUT_MINUTES = 5;

export interface ScheduleOperator {
  id: string;
  fullName: string;
  role: EmployeeRole;
  status: "online" | "ocupado" | "offline";
  assignment: string | null;
  region: string | null;
  heartbeatAt: string | null;
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
  status: "ready";
  metrics: ScheduleMetrics;
  operators: ScheduleOperator[];
  activeShift?: {
    name: string;
    startTime: string;
    endTime: string;
  };
}

/**
 * Carrega turnos ativos do VYRA2.
 */
export async function getActiveShifts() {
  const supabase = getVyraClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("central_shifts")
    .select("*")
    .eq("is_active", true);

  if (error) {
    console.error("Erro ao carregar turnos:", error);
    return [];
  }
  return data;
}

/**
 * Carrega escalas do período atual.
 */
export async function getCurrentShiftAssignments(shiftId: string) {
  const supabase = getVyraClient();
  if (!supabase) return [];

  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("central_shift_assignments")
    .select(`
      *,
      operator:central_profiles (
        id,
        full_name,
        central_user_roles (
          role:central_roles (
            code
          )
        )
      )
    `)
    .eq("shift_id", shiftId)
    .eq("date", today);

  if (error) {
    console.error("Erro ao carregar escalas:", error);
    return [];
  }
  return data;
}

/**
 * Carrega presença e heartbeat dos operadores.
 */
export async function getOperatorPresence() {
  const supabase = getVyraClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("central_operator_presence")
    .select("*");

  if (error) {
    console.error("Erro ao carregar presença:", error);
    return [];
  }
  return data;
}

/**
 * Carrega cobertura regional ativa.
 */
export async function getRegionAssignments() {
  const supabase = getVyraClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("central_region_assignments")
    .select(`
      *,
      region:central_regions (
        id,
        name,
        code
      )
    `);

  if (error) {
    console.error("Erro ao carregar regiões:", error);
    return [];
  }
  return data;
}

/**
 * Serviço principal de carregamento e montagem de dados operacionais.
 */
export async function getScheduleData(): Promise<ScheduleData> {
  try {
    const supabase = getVyraClient();
    if (!supabase) {
      throw new Error("Cliente Supabase não disponível");
    }

    // 1. Carregar Turnos e identificar o ativo
    const shifts = await getActiveShifts();
    const activeShift = shifts[0]; // Simplificação para o primeiro ativo

    if (!activeShift) {
      return {
        status: "ready",
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

    // 2. Carregar dependências em paralelo
    const [assignments, presence, regions, regionAssignments] = await Promise.all([
      getCurrentShiftAssignments(activeShift.id),
      getOperatorPresence(),
      supabase.from("central_regions").select("*"),
      getRegionAssignments()
    ]);

    const totalRegions = regions.data?.length || 0;
    const presenceMap = new Map(presence.map(p => [p.operator_id, p]));
    const regionMap = new Map(regionAssignments.map(ra => [ra.operator_id, ra.region?.name || null]));

    // 3. Cruzamento de dados de atendimento (alertas assumidos)
    const { data: activeAlerts } = await supabase
      .from("alerts")
      .select("id, status, severity")
      .eq("status", "assumido"); // Simplificado: Idealmente buscar por assigned_operator_id se existisse a coluna. 
      // Por enquanto, vamos assumir que se o status é "assumido", ele está em atendimento.
      // Correção: a tabela alerts real do VYRA2 pode não ter assigned_operator_id direto. 
      // O prompt diz que VYRA2 tem central_alert_assignments (Lote 3B). 
      // Vamos tentar buscar os assignments ativos se possível.
    
    const { data: alertAssignments } = await supabase
      .from("central_alert_assignments" as any) // Tabela mencionada no lote anterior
      .select("alert_id, operator_id")
      .is("unassigned_at", null);

    const operatorAlertsMap = new Map<string, any[]>();
    if (alertAssignments) {
      alertAssignments.forEach((aa: any) => {
        const alerts = operatorAlertsMap.get(aa.operator_id) || [];
        alerts.push(aa);
        operatorAlertsMap.set(aa.operator_id, alerts);
      });
    }

    const now = new Date();
    const operators: ScheduleOperator[] = assignments.map((assign: any) => {
      const p = presenceMap.get(assign.operator_id);
      const profile = assign.operator;
      
      // Cálculo de status baseado em Heartbeat
      let status: "online" | "ocupado" | "offline" = "offline";
      const heartbeatAt = p?.heartbeat_at ? new Date(p.heartbeat_at) : null;
      const isHeartbeatValid = heartbeatAt && (now.getTime() - heartbeatAt.getTime()) < (HEARTBEAT_TIMEOUT_MINUTES * 60 * 1000);

      if (isHeartbeatValid) {
        const alerts = operatorAlertsMap.get(assign.operator_id) || [];
        status = alerts.length > 0 ? "ocupado" : "online";
      }

      // Extração da role (pegando a primeira encontrada)
      const roleCode = profile?.central_user_roles?.[0]?.role?.code || "operador";

      return {
        id: assign.operator_id,
        fullName: profile?.full_name || "Desconhecido",
        role: roleCode as EmployeeRole,
        status,
        assignment: status === "ocupado" ? "Atendimento ativo" : null,
        region: regionMap.get(assign.operator_id) || null,
        heartbeatAt: p?.heartbeat_at || null
      };
    });

    // 4. Cálculo de métricas
    const onlineCount = operators.filter(op => op.status !== "offline").length;
    const scaledTotal = operators.length;
    const availableCount = operators.filter(op => op.status === "online").length;
    const inProgressCount = operators.filter(op => op.status === "ocupado").length;
    
    // Cobertura regional
    const coveredRegions = new Set(regionAssignments.map(ra => ra.region_id)).size;

    return {
      status: "ready",
      metrics: {
        onlineCount,
        scaledTotal,
        availableCount,
        inProgressCount,
        criticalCount: 0, // Sem fonte para alertas críticos por operador neste momento
        coveredRegions,
        totalRegions,
      },
      operators,
      activeShift: {
        name: activeShift.name,
        startTime: activeShift.start_time,
        endTime: activeShift.end_time
      }
    };
  } catch (err) {
    console.error("Erro ao processar dados de escalas:", err);
    throw err;
  }
}

/**
 * Assinatura Realtime para a tela de escalas.
 */
export function subscribeToScheduleChanges(onUpdate: () => void) {
  const supabase = getVyraClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel("central-schedule-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "central_shift_assignments" },
      onUpdate
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "central_operator_presence" },
      onUpdate
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "central_region_assignments" },
      onUpdate
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "central_shift_handovers" },
      onUpdate
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
