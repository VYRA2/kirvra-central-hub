import { useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Radar, RefreshCw, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { KirvraAppShell } from "@/components/kirvra/app-shell";
import { AccessDenied, RequirePermission } from "@/components/kirvra/access-control";
import { GeoMapPanel } from "@/components/kirvra/geo-map-panel";
import {
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
  Panel,
  RiskBadge,
  StatusBadge,
} from "@/components/kirvra/primitives";
import { useAuth } from "@/hooks/use-auth";
import { formatElapsed, initialsFromName } from "@/lib/kirvra-format";
import { useCentralRealtime } from "@/hooks/use-central-realtime";
import { describeDataError, getCommandOverview } from "@/services/dashboard-service";

export const Route = createFileRoute("/_central/central")({
  head: () => ({
    meta: [
      { title: "Central de Comando | KIRVRA Central" },
      {
        name: "description",
        content:
          "Panorama em tempo real das sessões protegidas, alertas em fila e atendimentos ativos da KIRVRA Central.",
      },
      { property: "og:title", content: "Central de Comando · KIRVRA" },
      {
        property: "og:description",
        content:
          "Indicadores operacionais reais, mapa ao vivo e fila de alertas da KIRVRA Central.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <KirvraAppShell title="Central de Comando">
      <RequirePermission permissions={["dashboard.view"]}>
        <CommandCenterPage />
      </RequirePermission>
    </KirvraAppShell>
  ),
});

const METRIC_TONE: Record<string, "critical" | "warning" | "success" | "neutral"> = {
  sessoes: "success",
  novos: "warning",
  atendimento: "neutral",
  criticos: "critical",
};

function CommandCenterPage() {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["command-overview"],
    queryFn: getCommandOverview,
    refetchInterval: 30_000,
  });

  const realtime = useCentralRealtime(() => {
    void queryClient.invalidateQueries({ queryKey: ["command-overview"] });
  });

  const markers = useMemo(
    () =>
      (data?.sessions ?? [])
        .filter((session) => session.point !== null)
        .map((session) => ({
          id: session.id,
          label: session.driverName ?? "Sessão protegida",
          initials: initialsFromName(session.driverName ?? "SP"),
          latitude: session.point!.latitude,
          longitude: session.point!.longitude,
          risk: session.riskLevel,
          offline: session.state === "offline",
        })),
    [data],
  );

  const canSeeLocation = can("location.view");

  return (
    <>
      <PageHeader
        title="Visão operacional"
        description="Indicadores calculados diretamente das sessões e alertas registrados no backend KIRVRA. Nenhum número é estimado."
        className={undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => void refetch()}>
              <RefreshCw
                className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                aria-hidden="true"
              />
              Atualizar
            </Button>
            <Button asChild>
              <Link to="/monitoramento">
                <Radar className="h-4 w-4" aria-hidden="true" />
                Abrir monitoramento
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/alertas" search={{}}>
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                Ver alertas
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <StatusBadge
          tone={
            realtime.status === "conectado"
              ? "success"
              : realtime.status === "erro"
                ? "critical"
                : "warning"
          }
        >
          Tempo real: {realtime.status}
        </StatusBadge>
        {data ? <span className="tabular">Atualizado {formatElapsed(data.updatedAt)}</span> : null}
      </div>

      {isLoading ? <LoadingState rows={5} /> : null}
      {isError ? (
        <ErrorState
          description={describeDataError(error)}
          action={<Button onClick={() => void refetch()}>Tentar novamente</Button>}
          className={undefined}
        />
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {data.metrics.map((metric) => (
              <MetricCard
                key={metric.id}
                label={metric.label}
                value={metric.value === null ? "—" : String(metric.value)}
                hint={metric.hint}
                tone={METRIC_TONE[metric.id] ?? "neutral"}
              />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Panel
              title="Mapa operacional"
              description="Somente sessões com localização válida geram marcador"
              bodyClassName="p-0"
              actions={undefined}
              className={undefined}
            >
              {canSeeLocation ? (
                <GeoMapPanel className="min-h-[420px] rounded-none border-0" markers={markers} />
              ) : (
                <div className="p-4">
                  <AccessDenied message="Seu cargo não possui a permissão location.view para visualizar localização em tempo real." />
                </div>
              )}
            </Panel>

            <div className="flex flex-col gap-4">
              <Panel
                title="Alertas prioritários"
                description="Severidade e tempo de espera"
                bodyClassName="divide-y divide-border p-0"
                actions={undefined}
                className={undefined}
              >
                {data.priorityAlerts.length === 0 ? (
                  <p className="p-4 text-xs text-muted-foreground">
                    Nenhum alerta aberto no momento.
                  </p>
                ) : (
                  data.priorityAlerts.map((alert) => (
                    <Link
                      key={alert.id}
                      to="/alertas/$alertId"
                      params={{ alertId: alert.id }}
                      search={{}}
                      className="block px-4 py-3 hover:bg-surface-raised"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-sm text-foreground">
                          {alert.threatType ?? "Alerta"}
                        </p>
                        <RiskBadge level={alert.severity ?? "normal"} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {[alert.driverName, alert.locationLabel].filter(Boolean).join(" · ") ||
                          "Sem detalhes registrados"}
                      </p>
                      <p className="tabular mt-0.5 text-[11px] text-muted-foreground">
                        {alert.detectedAt
                          ? `Detectado ${formatElapsed(alert.detectedAt)}`
                          : "Horário não registrado"}
                      </p>
                    </Link>
                  ))
                )}
              </Panel>

              <Panel title="Motoristas protegidos agora" bodyClassName="divide-y divide-border p-0">
                {data.protectedDrivers.length === 0 ? (
                  <p className="p-4 text-xs text-muted-foreground">
                    Nenhuma sessão ativa registrada.
                  </p>
                ) : (
                  data.protectedDrivers.map((driver) => (
                    <div
                      key={driver.sessionId}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">
                          {driver.name ?? "Motorista não identificado"}
                        </p>
                        <p className="tabular truncate text-[11px] text-muted-foreground">
                          {driver.plate ?? "Placa não registrada"}
                          {driver.lastHeartbeatAt
                            ? ` · ${formatElapsed(driver.lastHeartbeatAt)}`
                            : ""}
                        </p>
                      </div>
                      <RiskBadge level={driver.risk ?? "normal"} />
                    </div>
                  ))
                )}
              </Panel>

              <Panel title="Eventos recentes" bodyClassName="divide-y divide-border p-0">
                {data.recentEvents.length === 0 ? (
                  <p className="p-4 text-xs text-muted-foreground">Nenhum evento registrado.</p>
                ) : (
                  data.recentEvents.map((event) => (
                    <div key={event.id} className="px-4 py-2.5">
                      <p className="truncate text-xs text-foreground">{event.label}</p>
                      <p className="tabular truncate text-[11px] text-muted-foreground">
                        {event.detail || "Sem detalhes"}
                        {event.at ? ` · ${formatElapsed(event.at)}` : ""}
                      </p>
                    </div>
                  ))
                )}
              </Panel>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
