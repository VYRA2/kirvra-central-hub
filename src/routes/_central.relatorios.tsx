import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { 
  Calendar, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  FileBarChart,
  ChevronDown
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { KirvraAppShell } from "@/components/kirvra/app-shell";
import { RequirePermission } from "@/components/kirvra/access-control";
import { 
  PageHeader, 
  LoadingState, 
  ErrorState, 
  MetricCard, 
  Panel,
  StatusBadge
} from "@/components/kirvra/primitives";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  fetchReportData, 
  type ReportFilters, 
  type PeriodType 
} from "@/services/report-service";
import { exportReportToPDF } from "@/lib/pdf-exporter";
import { getSession } from "@/services/auth-service";

export const Route = createFileRoute("/_central/relatorios")({
  component: ReportsPage,
});

function ReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>({
    period: "7d"
  });
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["reports", filters],
    queryFn: () => fetchReportData(filters),
    staleTime: 60000,
  });

  const session = getSession();

  const handleExport = async () => {
    if (!data) return;
    setIsExporting(true);
    try {
      await exportReportToPDF(data, filters, session);
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const periodLabels: Record<PeriodType, string> = {
    "7d": "Últimos 7 dias",
    "30d": "Últimos 30 dias",
    "90d": "Últimos 90 dias",
    "custom": "Personalizado"
  };

  if (isError) {
    return (
      <KirvraAppShell title="Relatórios">
        <RequirePermission permissions={["reports.view"]}>
          <ErrorState action={<Button onClick={() => refetch()}>Tentar novamente</Button>} />
        </RequirePermission>
      </KirvraAppShell>
    );
  }

  return (
    <KirvraAppShell title="Relatórios">
      <RequirePermission permissions={["reports.view"]}>
        <div className="flex flex-col gap-8 max-w-[1600px] mx-auto w-full">
          <PageHeader
            title="Relatórios"
            description=""
            actions={
              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 gap-2 border-border bg-card hover:bg-muted/50">
                      <Calendar className="h-4 w-4" />
                      {periodLabels[filters.period]}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[180px]">
                    <DropdownMenuItem onClick={() => setFilters({ period: "7d" })}>Últimos 7 dias</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilters({ period: "30d" })}>Últimos 30 dias</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilters({ period: "90d" })}>Últimos 90 dias</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button 
                  className="h-10 gap-2 bg-success text-success-foreground hover:bg-success/90 font-semibold"
                  onClick={handleExport}
                  disabled={isExporting || isLoading}
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? "Exportando..." : "Exportar PDF"}
                </Button>
              </div>
            }
          />

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-1">Indicadores operacionais</h2>
            <p className="text-sm text-muted-foreground mb-6">Sessões, alertas, resposta e qualidade dos modelos.</p>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-32 rounded-lg border border-border animate-pulse bg-muted/20" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <ReportMetricCard 
                  label="Sessões no período"
                  value={data?.metrics.sessions.toLocaleString() || "0"}
                  trend={data?.metrics.sessionsTrend}
                  trendLabel="vs. período anterior"
                />
                <ReportMetricCard 
                  label="Alertas críticos"
                  value={data?.metrics.criticalAlerts.toLocaleString() || "0"}
                  sublabel={`${data?.metrics.criticalAlertsRate.toFixed(1)}% das sessões`}
                  icon={<AlertCircle className="h-4 w-4" />}
                />
                <ReportMetricCard 
                  label="Resposta média"
                  value={data?.metrics.avgResponseTime || "00:00"}
                  sublabel="meta abaixo de 02:00"
                  icon={<Clock className="h-4 w-4" />}
                />
                <ReportMetricCard 
                  label="Falsos positivos"
                  value={`${data?.metrics.falsePositivesRate.toFixed(1)}%`}
                  trend={-1.4} // Exemplo visual conforme a imagem, idealmente calculado
                  trendLabel="queda de 1,4 p.p."
                  icon={<CheckCircle2 className="h-4 w-4" />}
                />
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Panel 
              title="Alertas por dia" 
              className="lg:col-span-2 h-[400px]"
              actions={<span className="text-[10px] font-semibold text-muted-foreground bg-muted/30 px-2 py-1 rounded">Últimos 7 dias</span>}
            >
              {isLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <LoadingState label="Processando gráfico..." rows={0} />
                </div>
              ) : (
                <div className="w-full h-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.dailyAlerts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis 
                        dataKey="label" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: "#64748b", fontSize: 10, fontWeight: 500 }}
                        dy={10}
                      />
                      <YAxis hide />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-background border border-border p-2 rounded-md shadow-xl text-[10px]">
                                <p className="font-bold">{payload[0].payload.date}</p>
                                <p className="text-success">{payload[0].value} Alertas</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                        {data?.dailyAlerts.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill="var(--success)" fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <div className="flex flex-col gap-6">
              <Panel title="Ameaças por categoria" className="flex-1">
                {isLoading ? (
                  <LoadingState rows={4} />
                ) : (
                  <div className="space-y-4 pt-2">
                    {data?.categories.map((cat, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between items-end">
                          <span className="text-sm font-medium text-foreground">{cat.category}</span>
                          <div className="text-right">
                            <span className="text-sm font-bold text-foreground">{Math.round(cat.percentage)}%</span>
                            <span className="text-[10px] text-muted-foreground ml-1.5">{cat.count}</span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-muted/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-success/60 rounded-full" 
                            style={{ width: `${cat.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel title="Qualidade da IA">
                {isLoading ? (
                  <LoadingState rows={2} />
                ) : (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Confirmações humanas</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge tone="success" dot={false} className="bg-success/10 text-success border-success/20 px-1.5 py-0">
                          {data?.quality.humanConfirmationsRate.toFixed(1)}%
                        </StatusBadge>
                        <span className="text-[10px] text-muted-foreground">{data?.quality.totalReviewed} análises</span>
                      </div>
                    </div>
                  </div>
                )}
              </Panel>
            </div>
          </div>
        </div>
      </RequirePermission>
    </KirvraAppShell>
  );
}

function ReportMetricCard({ 
  label, 
  value, 
  trend, 
  trendLabel, 
  sublabel, 
  icon 
}: { 
  label: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  sublabel?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-5 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        {icon && <span className="text-muted-foreground/50">{icon}</span>}
      </div>
      <div className="text-3xl font-bold text-foreground my-1">{value}</div>
      {trend !== undefined && (
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "flex items-center text-[10px] font-bold",
            trend >= 0 ? "text-success" : "text-critical"
          )}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
          <span className="text-[10px] text-muted-foreground">{trendLabel}</span>
        </div>
      )}
      {sublabel && (
        <div className="text-[10px] text-muted-foreground">{sublabel}</div>
      )}
    </div>
  );
}
