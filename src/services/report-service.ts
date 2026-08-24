import { getVyraClient } from "@/integrations/vyra/client";
import { 
  subDays, 
  startOfDay, 
  endOfDay, 
  format, 
  parseISO,
  differenceInSeconds
} from "date-fns";

export interface ReportMetrics {
  sessions: number;
  sessionsTrend: number;
  criticalAlerts: number;
  criticalAlertsRate: number;
  avgResponseTime: string; // "MM:SS"
  avgResponseSeconds: number;
  falsePositivesRate: number;
}

export interface DailyAlertData {
  date: string;
  count: number;
  label: string; // "S", "T", "Q", etc.
}

export interface ThreatCategoryData {
  category: string;
  count: number;
  percentage: number;
}

export interface QualityData {
  humanConfirmationsRate: number;
  totalReviewed: number;
}

export interface ReportData {
  metrics: ReportMetrics;
  dailyAlerts: DailyAlertData[];
  categories: ThreatCategoryData[];
  quality: QualityData;
}

export type PeriodType = "7d" | "30d" | "90d" | "custom";

export interface ReportFilters {
  period: PeriodType;
  startDate?: Date;
  endDate?: Date;
}

function getPeriodRange(filters: ReportFilters) {
  const now = new Date();
  let start: Date;
  let end: Date = endOfDay(now);

  switch (filters.period) {
    case "7d":
      start = startOfDay(subDays(now, 6));
      break;
    case "30d":
      start = startOfDay(subDays(now, 29));
      break;
    case "90d":
      start = startOfDay(subDays(now, 89));
      break;
    case "custom":
      start = filters.startDate ? startOfDay(filters.startDate) : startOfDay(subDays(now, 6));
      end = filters.endDate ? endOfDay(filters.endDate) : endOfDay(now);
      break;
    default:
      start = startOfDay(subDays(now, 6));
  }

  const duration = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - duration - 1000);
  const prevEnd = new Date(start.getTime() - 1000);

  return { start, end, prevStart, prevEnd };
}

export async function fetchReportData(filters: ReportFilters): Promise<ReportData> {
  const supabase = getVyraClient();
  if (!supabase) throw new Error("VYRA client not configured");

  const { start, end, prevStart, prevEnd } = getPeriodRange(filters);

  // 1. Sessões
  const { count: currentSessions } = await supabase
    .from("protection_sessions")
    .select("*", { count: "exact", head: true })
    .gte("started_at", start.toISOString())
    .lte("started_at", end.toISOString());

  const { count: prevSessions } = await supabase
    .from("protection_sessions")
    .select("*", { count: "exact", head: true })
    .gte("started_at", prevStart.toISOString())
    .lte("started_at", prevEnd.toISOString());

  const sessionsTrend = prevSessions ? (( (currentSessions || 0) - prevSessions) / prevSessions) * 100 : 0;

  // 2. Alertas e Segurança (Critical Alerts)
  const { data: securityAlerts } = await supabase
    .from("security_alerts")
    .select("*")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  const alerts = securityAlerts || [];
  const criticalAlerts = alerts.filter(a => {
    const type = (a.threat_type || "").toLowerCase();
    const status = (a.status || "").toLowerCase();
    return type === 'critico' || status === 'critico';
  }).length;
  const criticalAlertsRate = currentSessions ? (criticalAlerts / currentSessions) * 100 : 0;

  // 3. Resposta Média
  const { data: assignments } = await supabase
    .from("central_alert_assignments")
    .select("alert_id, created_at")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .not("created_at", "is", null);

  let totalResponseSeconds = 0;
  let responseCount = 0;

  if (assignments && assignments.length > 0) {
    assignments.forEach(asg => {
      const alert = alerts.find(a => a.id === asg.alert_id);
      if (alert && alert.created_at && asg.created_at) {
        const diff = differenceInSeconds(parseISO(asg.created_at), parseISO(alert.created_at));
        if (diff >= 0) {
          totalResponseSeconds += diff;
          responseCount++;
        }
      }
    });
  }

  const avgResponseSeconds = responseCount ? Math.floor(totalResponseSeconds / responseCount) : 0;
  const avgResponseTime = `${String(Math.floor(avgResponseSeconds / 60)).padStart(2, '0')}:${String(avgResponseSeconds % 60).padStart(2, '0')}`;

  // 4. Falsos Positivos
  const reviewedAlerts = alerts.filter(a => a.status === 'falso_positivo' || a.status === 'confirmado' || a.status === 'encerrado');
  const falsePositives = reviewedAlerts.filter(a => a.status === 'falso_positivo').length;
  const falsePositivesRate = reviewedAlerts.length ? (falsePositives / reviewedAlerts.length) * 100 : 0;

  // 5. Alertas por dia
  const dailyAlerts: DailyAlertData[] = [];
  const dayNames = ["D", "S", "T", "Q", "Q", "S", "S"];
  
  const tempDate = new Date(start);
  while (tempDate <= end) {
    const dayStart = startOfDay(tempDate);
    const dayEnd = endOfDay(tempDate);
    const count = alerts.filter(a => {
      const dateStr = a.created_at;
      if (!dateStr) return false;
      const date = parseISO(dateStr);
      return date >= dayStart && date <= dayEnd;
    }).length;
    
    dailyAlerts.push({
      date: format(tempDate, "yyyy-MM-dd"),
      count,
      label: dayNames[tempDate.getDay()]
    });
    
    tempDate.setDate(tempDate.getDate() + 1);
  }

  // 6. Ameaças por Categoria
  const categoryMap: Record<string, number> = {
    "Possível arma/assalto": 0,
    "Violência corporal": 0,
    "Áudio/palavra de risco": 0,
    "Outros sinais": 0,
  };

  alerts.forEach(a => {
    const type = (a.threat_type || "").toLowerCase();
    if (type.includes("arma") || type.includes("assalto")) categoryMap["Possível arma/assalto"]++;
    else if (type.includes("violencia") || type.includes("corporal")) categoryMap["Violência corporal"]++;
    else if (type.includes("audio") || type.includes("palavra")) categoryMap["Áudio/palavra de risco"]++;
    else categoryMap["Outros sinais"]++;
  });

  const categories: ThreatCategoryData[] = Object.entries(categoryMap).map(([category, count]) => ({
    category,
    count,
    percentage: alerts.length ? (count / alerts.length) * 100 : 0,
  }));

  // 7. Qualidade da IA
  const confirmedByHumans = alerts.filter(a => a.status === 'confirmado').length;
  const humanConfirmationsRate = reviewedAlerts.length ? (confirmedByHumans / reviewedAlerts.length) * 100 : 0;

  return {
    metrics: {
      sessions: currentSessions || 0,
      sessionsTrend,
      criticalAlerts,
      criticalAlertsRate,
      avgResponseTime,
      avgResponseSeconds,
      falsePositivesRate,
    },
    dailyAlerts,
    categories,
    quality: {
      humanConfirmationsRate,
      totalReviewed: reviewedAlerts.length,
    }
  };
}
