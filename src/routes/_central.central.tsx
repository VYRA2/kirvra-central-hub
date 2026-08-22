import { useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Radar, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { KirvraAppShell } from "@/components/kirvra/app-shell";
import { AlertCard } from "@/components/kirvra/data-display";
import { LiveMapPanel } from "@/components/kirvra/map-panel";
import {
  DriverAvatar,
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
  Panel,
  RiskBadge,
  StatusBadge,
} from "@/components/kirvra/primitives";
import { formatElapsed } from "@/lib/kirvra-format";
import { getCommandOverview } from "@/services/dashboard-service";
import { findDriver, findVehicle } from "@/mocks/kirvra-central";

export const Route = createFileRoute("/_central/central")({
  component: CommandCenterPage,
});

const METRIC_TONE: Record<string, "critical" | "warning" | "success"> = {
  criticos: "critical",
  novos: "warning",
  heartbeats: "success",
};

function CommandCenterPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["command-overview"],
    queryFn: getCommandOverview,
  });

  const focused = useMemo(() => {
    if (!data) return null;
    const session =
      data.liveSessions.find((s) => s.id === data.focusedSessionId) ?? null;
    if (!session) return null;
    return {
      session,
      driver: findDriver(session.driverId),
      vehicle: findVehicle(session.vehicleId),
      alertId: session.alertIds[0] ?? null,
    };
  }, [data]);

  return (
    <KirvraAppShell title="Central de Comando">
      <PageHeader
        title="Visão operacional"
        description="Panorama em tempo real das sessões protegidas, dos alertas em fila e da saúde dos serviços que sustentam a Central."
        className={undefined}
        actions={
          <>
            <Button asChild>
              <Link to="/monitoramento">
                <Radar className="h-4 w-4" aria-hidden="true" />
                Abrir monitoramento
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/alertas" search={{} as any}>
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                Ver alertas
              </Link>
            </Button>
          </>
        }
      />

      {isLoading ? <LoadingState rows={5} /> : null}
      {isError ? <ErrorState action={<Button onClick={() => void refetch()}>Tentar novamente</Button>} className={undefined} /> : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            {data.metrics.map((metric) => (
              <MetricCard
                key={metric.id}
                label={metric.label}
                value={metric.value}
                hint={metric.hint}
                tone={METRIC_TONE[metric.id] ?? "neutral"}
              />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Panel
              title="Mapa operacional"
              description="Sessões protegidas em execução · destaque para o alerta crítico"
              bodyClassName="p-0"
              actions={undefined}
              className={undefined}
            >
              <LiveMapPanel
                className="min-h-[420px] rounded-none border-0"
                activeId={focused?.session.id ?? null}
                track={focused?.session.track ?? []}
                markers={data.liveSessions.map((session) => ({
                  id: session.id,
                  label: findDriver(session.driverId)?.displayName ?? "Sessão",
                  x: session.mapPosition.x,
                  y: session.mapPosition.y,
                  risk: session.riskLevel,
                  offline: session.state === "offline",
                }))}
                onSelect={undefined}
                footer={undefined}
                overlay={
                  focused ? (
                    <div className="absolute top-4 left-4 z-10 max-w-[280px]">
                      <div className="rounded-lg border border-border bg-background/95 p-3 shadow-lg backdrop-blur-sm">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground uppercase">
                            Foco em Tempo Real
                          </span>
                        </div>
                        <div className="mb-3 flex items-center gap-3">
                          <DriverAvatar
                            initials={
                              findDriver(focused.session.driverId)?.initials ?? "??"
                            }
                            size="md"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-foreground">
                              {findDriver(focused.session.driverId)?.displayName ??
                                "Desconhecido"}
                            </p>
                            <div className="flex items-center gap-2">
                              <RiskBadge level={focused.session.riskLevel} />
                            </div>
                          </div>
                        </div>
                        <Button size="sm" className="w-full" asChild>
                          <Link
                            to="/sessoes/$sessionId"
                            params={{ sessionId: focused.session.id } as any}
                            search={{} as any}
                          >
                            Acompanhar
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ) : undefined
                }
              />
                overlay={
                  focused?.driver ? (
                    <div className="absolute top-4 right-4 w-[290px] rounded-lg border border-critical/40 bg-card/95 p-3 backdrop-blur-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {focused.driver.displayName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {focused.vehicle
                              ? `${focused.vehicle.make} ${focused.vehicle.model} · ${focused.vehicle.plate}`
                              : "Veículo não informado"}
                          </p>
                        </div>
                        <StatusBadge tone="critical">Crítico</StatusBadge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {focused.session.location.address}
                      </p>
                      <p className="tabular mt-1 text-[11px] text-muted-foreground">
                        Atualizado {formatElapsed(focused.session.lastHeartbeatAt)}
                      </p>
                      <div className="mt-3 flex gap-2">
                        {focused.alertId ? (
                          <Button size="sm" asChild>
                            <Link
                              to="/alertas/$alertId"
                              params={{ alertId: focused.alertId } as any}
                              search={{} as any}
                            >
                              Abrir alerta
                            </Link>
                          </Button>
                        ) : null}
                        <Button size="sm" variant="outline" asChild>
                          <Link
                            to="/sessoes/$sessionId"
                            params={{ sessionId: focused.session.id } as any}
                            search={{} as any}
                          >
                            Acompanhar
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ) : undefined
                }
              />

            <div className="flex flex-col gap-4">
              <Panel
                title="Alertas prioritários"
                description="Ordenados por severidade e tempo de espera"
                bodyClassName="space-y-3 p-3"
                actions={undefined}
                className={undefined}
              >
                {data.priorityAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    driverName={
                      findDriver(alert.driverId)?.displayName ?? "Motorista"
                    }
                  />
                ))}
              </Panel>

              <Panel title="Saúde do sistema" bodyClassName="p-0">
                <ul className="divide-y divide-border">
                  {data.health.map((service) => (
                    <li
                      key={service.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">
                          {service.service}
                        </p>
                        <p className="tabular truncate text-xs text-muted-foreground">
                          {service.latencyMs !== null
                            ? `Latência ${service.latencyMs} ms`
                            : null}
                          {service.queueSize !== null
                            ? `${service.latencyMs !== null ? " · " : ""}${service.queueSize} trabalhos`
                            : null}
                        </p>
                      </div>
                      <StatusBadge
                        tone={
                          service.state === "online"
                            ? "success"
                            : service.state === "degradado"
                              ? "warning"
                              : "critical"
                        }
                      >
                        {service.state === "online"
                          ? "Online"
                          : service.state === "degradado"
                            ? "Degradado"
                            : "Offline"}
                      </StatusBadge>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        </>
      ) : null}
    </KirvraAppShell>
  );
}
