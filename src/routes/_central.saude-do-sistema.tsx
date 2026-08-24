import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
  Activity, 
  RefreshCcw, 
  ShieldCheck, 
  Zap, 
  Clock, 
  Layers, 
  AlertCircle,
  Database,
  Cloud,
  Cpu,
  Server,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2
} from "lucide-react";

import { KirvraAppShell } from "@/components/kirvra/app-shell";
import { 
  MetricCard, 
  PageHeader, 
  Panel, 
  StatusBadge, 
  BadgeTone,
  LoadingState,
  EmptyState
} from "@/components/kirvra/primitives";
import { Button } from "@/components/ui/button";
import { 
  SystemHealthService, 
  SystemHealthOverview, 
  HealthStatus,
  ServiceHealthSnapshot 
} from "@/services/system-health-service";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_central/saude-do-sistema")({
  component: SystemHealthPage,
});

function HealthStatusBadge({ status }: { status: HealthStatus }) {
  const tones: Record<HealthStatus, BadgeTone> = {
    online: "success",
    degradado: "warning",
    offline: "critical",
    pendente: "neutral",
    indisponivel: "neutral",
  };

  const labels: Record<HealthStatus, string> = {
    online: "Online",
    degradado: "Degradado",
    offline: "Offline",
    pendente: "Integração pendente",
    indisponivel: "Indisponível",
  };

  return (
    <StatusBadge tone={tones[status]}>
      {labels[status]}
    </StatusBadge>
  );
}

function ServiceIcon({ id }: { id: string }) {
  switch (id) {
    case "db": return <Database className="h-4 w-4" />;
    case "storage": return <Cloud className="h-4 w-4" />;
    case "realtime": return <Zap className="h-4 w-4" />;
    case "ai-engine": return <Cpu className="h-4 w-4" />;
    case "runpod": return <Server className="h-4 w-4" />;
    default: return <Activity className="h-4 w-4" />;
  }
}

function SystemHealthPage() {
  const [data, setData] = useState<SystemHealthOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [diagnosticating, setDiagnosticating] = useState(false);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const snapshot = await SystemHealthService.getSystemHealthSnapshot();
      setData(snapshot);
      if (isRefresh) {
        toast.success("Estado do sistema atualizado com sucesso.");
      }
    } catch (err) {
      toast.error("Erro ao carregar saúde do sistema.");
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleDiagnostic = async () => {
    const confirmed = window.confirm("Deseja executar o diagnóstico completo de infraestrutura? Isso realizará testes ativos em todos os serviços conectados.");
    if (!confirmed) return;

    setDiagnosticating(true);
    try {
      const result = await SystemHealthService.runSystemDiagnostic();
      setData(result);
      
      const summary = {
        online: result.services.filter(s => s.status === "online").length,
        offline: result.services.filter(s => s.status === "offline").length,
        degradado: result.services.filter(s => s.status === "degradado").length,
        pendente: result.services.filter(s => s.status === "pendente").length,
      };

      toast.info(`Diagnóstico concluído: ${summary.online} Online, ${summary.degradado} Degradado, ${summary.offline} Offline, ${summary.pendente} Pendentes.`);
    } catch (err) {
      toast.error("Erro ao executar diagnóstico.");
    } finally {
      setDiagnosticating(false);
    }
  };

  if (loading) {
    return (
      <KirvraAppShell title="Saúde do sistema">
        <LoadingState label="Verificando infraestrutura..." />
      </KirvraAppShell>
    );
  }

  return (
    <KirvraAppShell title="Saúde do sistema">
      <div className="space-y-6">
        <PageHeader
          title="Saúde do sistema"
          description="Monitoramento em tempo real da infraestrutura e serviços críticos da Central KIRVRA."
          actions={
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => loadData(true)}
                disabled={refreshing || diagnosticating}
              >
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                Atualizar
              </Button>
              <Button 
                size="sm" 
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleDiagnostic}
                disabled={refreshing || diagnosticating}
              >
                {diagnosticating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                Executar diagnóstico
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Disponibilidade"
            value={data?.availability || "—"}
            sublabel="Últimos 30 dias"
            tone={data?.availability !== "—" ? "success" : "neutral"}
          />
          <MetricCard
            label="Latência média"
            value={data?.averageLatencyMs ? `${data.averageLatencyMs} ms` : "—"}
            sublabel="Medição atual"
            tone={data?.averageLatencyMs ? (data.averageLatencyMs < 200 ? "success" : "warning") : "neutral"}
          />
          <MetricCard
            label="Fila de IA"
            value={data?.aiQueueSize !== null ? String(data.aiQueueSize) : "—"}
            sublabel="Processamentos pendentes"
            tone={data?.aiQueueSize === 0 ? "success" : "neutral"}
          />
          <MetricCard
            label="Incidentes"
            value={String(data?.incidentCount || 0)}
            sublabel="Nas últimas 24h"
            tone={data?.incidentCount === 0 ? "success" : "critical"}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Panel title="Serviços e Integrações" description="Status detalhado de cada componente da plataforma.">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase">
                      <th className="px-4 py-3">Serviço</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Latência</th>
                      <th className="px-4 py-3 text-right">Última verificação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data?.services.map((service) => (
                      <tr key={service.id} className="group hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg border",
                              service.status === "online" ? "border-success/20 bg-success/5 text-success" : 
                              service.status === "offline" ? "border-critical/20 bg-critical/5 text-critical" :
                              service.status === "degradado" ? "border-warning/20 bg-warning/5 text-warning" :
                              "border-border bg-muted/20 text-muted-foreground"
                            )}>
                              <ServiceIcon id={service.id} />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{service.service}</p>
                              <p className="text-[11px] text-muted-foreground">{service.message}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <HealthStatusBadge status={service.status} />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-mono text-xs">
                          {service.latencyMs ? `${service.latencyMs}ms` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                          {format(new Date(service.lastCheckAt), "HH:mm:ss", { locale: ptBR })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <div>
            <Panel title="Eventos Recentes" description="Log de alterações na infraestrutura.">
              {data?.recentEvents && data.recentEvents.length > 0 ? (
                <div className="space-y-4">
                  {data.recentEvents.map((event) => (
                    <div key={event.id} className="relative pl-4 before:absolute before:left-0 before:top-2 before:h-full before:w-[1px] before:bg-border last:before:h-2">
                      <div className="absolute left-[-4px] top-1.5 h-2 w-2 rounded-full border border-background bg-primary" />
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-foreground">{event.service}</span>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(event.timestamp), "HH:mm", { locale: ptBR })}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{event.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center opacity-50">
                  <Activity className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Nenhum evento de infraestrutura registrado.</p>
                </div>
              )}
            </Panel>
          </div>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <h4 className="text-sm font-semibold text-foreground">Relatório Técnico</h4>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Esta página realiza diagnósticos diretos a partir do seu navegador para o Supabase VYRA2. 
                Os indicadores de <strong>AI Engine</strong> e <strong>RunPod</strong> exigem credenciais de servidor 
                e permanecem em estado pendente até a configuração das variáveis de ambiente no backend da Central.
              </p>
            </div>
          </div>
        </div>
      </div>
    </KirvraAppShell>
  );
}
