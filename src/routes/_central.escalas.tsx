import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Users, Activity, ShieldCheck, Calendar, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { KirvraAppShell } from "@/components/kirvra/app-shell";
import {
  MetricCard,
  PageHeader,
  Panel,
  StatusBadge,
  LoadingState,
  ErrorState,
  PermissionDeniedState,
  PendingIntegrationNotice,
  DriverAvatar,
} from "@/components/kirvra/primitives";
import { getScheduleData } from "@/services/schedule-service";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_central/escalas")({
  component: SchedulesPage,
});

function SchedulesPage() {
  const { can } = useAuth();
  const hasPermission = can("schedules.manage");

  if (!hasPermission) {
    return (
      <KirvraAppShell title="Escalas e operadores">
        <PermissionDeniedState description="Seu cargo não possui autorização para gerenciar escalas e operadores." />
      </KirvraAppShell>
    );
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["schedules"],
    queryFn: getScheduleData,
    refetchInterval: 30000,
  });

  const handleActionClick = (action: string) => {
    toast.info(`${action} ainda não conectada`, {
      description: "O backend administrativo de escalas e turnos precisa ser implementado.",
    });
  };

  if (isLoading) {
    return (
      <KirvraAppShell title="Escalas e operadores">
        <PageHeader title="Escalas e operadores" description="Carregando dados operacionais..." />
        <LoadingState label="Consultando escalas..." />
      </KirvraAppShell>
    );
  }

  if (error) {
    return (
      <KirvraAppShell title="Escalas e operadores">
        <ErrorState />
      </KirvraAppShell>
    );
  }

  const metrics = data?.metrics || {
    onlineCount: 0,
    scaledTotal: 0,
    availableCount: 0,
    inProgressCount: 0,
    criticalCount: 0,
    coveredRegions: 0,
    totalRegions: 0,
  };

  const isPending = data?.status === "integrationPending";

  return (
    <KirvraAppShell title="Escalas e operadores">
      <div className="space-y-6">
        <PageHeader
          title="Escalas e operadores"
          actions={
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => handleActionClick("Gestão de escalas")}
              >
                <Calendar className="h-4 w-4" />
                Gerenciar escalas
              </Button>
              <Button
                size="sm"
                className="gap-2"
                onClick={() => handleActionClick("Transferência de turno")}
              >
                <RefreshCcw className="h-4 w-4" />
                Transferir turno
              </Button>
            </div>
          }
        />

        {/* Mensagem de integração removida pois agora os dados são reais */}

        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-foreground">Turno atual</h2>
          <p className="text-sm text-muted-foreground">
            Cobertura, disponibilidade e distribuição dos atendimentos.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Online"
            value={metrics.onlineCount.toString()}
            sublabel={`de ${metrics.scaledTotal} escalados`}
            tone={metrics.onlineCount > 0 ? "success" : "neutral"}
          />
          <MetricCard
            label="Disponíveis"
            value={metrics.availableCount.toString()}
            sublabel="sem atendimento"
            tone="neutral"
          />
          <MetricCard
            label="Em atendimento"
            value={metrics.inProgressCount.toString()}
            sublabel={`${metrics.criticalCount} críticos`}
            tone={metrics.criticalCount > 0 ? "critical" : "neutral"}
          />
          <MetricCard
            label="Regiões cobertas"
            value={`${metrics.coveredRegions}/${metrics.totalRegions}`}
            sublabel={metrics.coveredRegions === metrics.totalRegions && metrics.totalRegions > 0 ? "cobertura completa" : "cobertura parcial"}
            tone={metrics.coveredRegions > 0 ? "primary" : "neutral"}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel
            title="Operadores do turno · 18h-02h"
            className="lg:col-span-2"
            bodyClassName="p-0"
          >
            {isPending || data?.operators.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Users className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">
                  Escalas ainda não configuradas
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Nenhum registro de operador escalado para este turno.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data?.operators.map((op) => (
                  <div key={op.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <DriverAvatar initials={op.fullName.substring(0, 2).toUpperCase()} size="md" />
                        <span 
                          className={cn(
                            "absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-card",
                            op.status === "online" ? "bg-success" : op.status === "ocupado" ? "bg-warning" : "bg-muted-foreground"
                          )} 
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {op.fullName} · {op.role}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {op.status === "ocupado" ? `Atendendo ${op.assignment}` : op.region ? `Disponível · ${op.region}` : "Sem heartbeat de estação"}
                        </p>
                      </div>
                    </div>
                    <StatusBadge tone={op.status === "online" ? "success" : op.status === "ocupado" ? "warning" : "neutral"}>
                      {op.status.charAt(0).toUpperCase() + op.status.slice(1)}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Cobertura por região" bodyClassName="p-0 relative h-[400px] bg-card/50 overflow-hidden">
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              {/* Representação visual do mapa estilizado da referência */}
              <div className="relative mb-6 h-64 w-full max-w-[300px]">
                <svg viewBox="0 0 200 200" className="h-full w-full opacity-20">
                  <path d="M20 100 L180 100 M100 20 L100 180 M60 60 L140 140 M140 60 L60 140" stroke="currentColor" strokeWidth="0.5" fill="none" />
                  <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="0.5" fill="none" />
                  <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="0.5" fill="none" />
                </svg>
                
                {/* Pins de exemplo apenas visuais (inativos) na ausência de dados reais */}
                {!isPending && metrics.totalRegions > 0 && (
                   <div className="absolute inset-0 pointer-events-none">
                     <div className="absolute top-[30%] left-[20%] h-6 w-6 rounded-full bg-primary/80 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">LC</div>
                     <div className="absolute top-[45%] right-[25%] h-6 w-6 rounded-full bg-critical/80 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">AS</div>
                     <div className="absolute bottom-[35%] right-[40%] h-6 w-6 rounded-full bg-warning/80 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">RM</div>
                     <div className="absolute bottom-[20%] left-[45%] h-6 w-6 rounded-full bg-primary/80 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">JV</div>
                   </div>
                )}
              </div>
              
              {isPending || metrics.totalRegions === 0 ? (
                <div>
                  <MapPin className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Cobertura regional ainda não configurada
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/60">
                    Defina regiões operacionais para visualizar o mapa.
                  </p>
                </div>
              ) : (
                <div className="absolute bottom-4 left-4 right-4">
                   <div className="flex items-center justify-between rounded bg-background/80 p-2 backdrop-blur-sm border border-border">
                      <div className="text-left">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Região Ativa</p>
                        <p className="text-xs font-medium text-foreground">Centro Expandido</p>
                      </div>
                      <ShieldCheck className="h-4 w-4 text-success" />
                   </div>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </KirvraAppShell>
  );
}
