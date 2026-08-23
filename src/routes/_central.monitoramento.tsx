import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KirvraAppShell } from "@/components/kirvra/app-shell";
import { RequirePermission } from "@/components/kirvra/access-control";
import { GeoMapPanel } from "@/components/kirvra/geo-map-panel";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  RiskBadge,
  StatusBadge,
} from "@/components/kirvra/primitives";
import { useCentralRealtime } from "@/hooks/use-central-realtime";
import { formatElapsed, initialsFromName } from "@/lib/kirvra-format";
import { cn } from "@/lib/utils";
import type { RiskLevel, SensorState } from "@/integrations/vyra/types";
import { describeDataError } from "@/services/dashboard-service";
import {
  applyMonitoringFilters,
  getMonitoringData,
  locatableSessions,
  type MonitoringFilters,
} from "@/services/monitoring-service";

export const Route = createFileRoute("/_central/monitoramento")({
  head: () => ({
    meta: [
      { title: "Monitoramento ao Vivo | KIRVRA Central" },
      {
        name: "description",
        content:
          "Mapa operacional em tempo real das sessões protegidas KIRVRA, com filtros de risco e telemetria de sensores.",
      },
      { property: "og:title", content: "Monitoramento ao Vivo · KIRVRA" },
      {
        property: "og:description",
        content:
          "Sessões protegidas ao vivo, localização real e status de câmera, áudio, GPS e rede.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <KirvraAppShell title="Monitoramento ao Vivo">
      <RequirePermission permissions={["sessions.view", "location.view"]}>
        <MonitoringPage />
      </RequirePermission>
    </KirvraAppShell>
  ),
});

const RISK_OPTIONS: Array<{ value: RiskLevel | "todos"; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "normal", label: "Normal" },
  { value: "atencao", label: "Atenção" },
  { value: "suspeito", label: "Suspeito" },
  { value: "critico", label: "Crítico" },
];

function MonitoringPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<MonitoringFilters>({
    search: "",
    risk: "todos",
    onlyOffline: false,
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["monitoring"],
    queryFn: getMonitoringData,
    refetchInterval: 20_000,
  });

  const realtime = useCentralRealtime(() => {
    void queryClient.invalidateQueries({ queryKey: ["monitoring"] });
  });

  const sessions = useMemo(
    () => applyMonitoringFilters(data?.sessions ?? [], filters),
    [data, filters],
  );

  const markers = useMemo(
    () =>
      locatableSessions(sessions).map((session) => ({
        id: session.id,
        label: session.driverName ?? "Sessão protegida",
        initials: initialsFromName(session.driverName ?? "SP"),
        latitude: session.point!.latitude,
        longitude: session.point!.longitude,
        risk: session.riskLevel,
        offline: session.state === "offline",
      })),
    [sessions],
  );

  const active = sessions.find((session) => session.id === activeId) ?? null;

  return (
    <>
      <PageHeader
        title="Monitoramento ao vivo"
        description="Sessões protegidas em execução com localização real. Sessões sem coordenada registrada aparecem apenas na lista."
        className={undefined}
        actions={
          <>
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
            <Button variant="outline" onClick={() => void refetch()}>
              <RefreshCw
                className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                aria-hidden="true"
              />
              Atualizar
            </Button>
          </>
        }
      />

      {isLoading ? <LoadingState rows={4} /> : null}
      {isError ? (
        <ErrorState
          description={describeDataError(error)}
          action={<Button onClick={() => void refetch()}>Tentar novamente</Button>}
          className={undefined}
        />
      ) : null}

      {data ? (
        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            <Panel
              title="Filtros"
              bodyClassName="space-y-3 p-3"
              actions={undefined}
              className={undefined}
            >
              <div className="relative">
                <Search
                  className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  aria-label="Buscar por motorista ou placa"
                  placeholder="Motorista ou placa"
                  className="pl-8"
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      search: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {RISK_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, risk: option.value }))}
                    aria-pressed={filters.risk === option.value}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[11px] transition-colors",
                      filters.risk === option.value
                        ? "border-primary/60 bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={filters.onlyOffline}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      onlyOffline: event.target.checked,
                    }))
                  }
                  className="h-3.5 w-3.5 accent-primary"
                />
                Somente sessões offline
              </label>
            </Panel>

            <Panel
              title={`Sessões protegidas (${sessions.length})`}
              bodyClassName="divide-y divide-border p-0"
              actions={undefined}
              className={undefined}
            >
              {sessions.length === 0 ? (
                <div className="p-3">
                  <EmptyState
                    title="Nenhuma sessão encontrada"
                    description="Ajuste os filtros ou aguarde novas sessões de proteção."
                    action={undefined}
                    className={undefined}
                  />
                </div>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setActiveId(session.id)}
                    aria-pressed={activeId === session.id}
                    className={cn(
                      "block w-full px-3 py-2.5 text-left hover:bg-surface-raised",
                      activeId === session.id && "bg-surface-raised",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-sm text-foreground">
                        {session.driverName ?? "Motorista não identificado"}
                      </p>
                      <RiskBadge level={session.riskLevel ?? "normal"} />
                    </div>
                    <p className="tabular truncate text-[11px] text-muted-foreground">
                      {session.plate ?? "Placa não registrada"}
                      {session.lastHeartbeatAt
                        ? ` · ${formatElapsed(session.lastHeartbeatAt)}`
                        : " · sem heartbeat"}
                    </p>
                    {session.point === null ? (
                      <p className="mt-1 text-[11px] text-warning">
                        Sem localização válida registrada
                      </p>
                    ) : null}
                  </button>
                ))
              )}
            </Panel>
          </div>

          <div className="flex flex-col gap-3">
            <Panel
              title="Mapa operacional"
              description="OpenStreetMap · marcadores somente com coordenada real"
              bodyClassName="p-0"
              actions={undefined}
              className={undefined}
            >
              <GeoMapPanel
                className="min-h-[520px] rounded-none border-0"
                markers={markers}
                activeId={activeId}
                onSelect={setActiveId}
              />
            </Panel>

            {active ? (
              <Panel
                title="Sessão selecionada"
                bodyClassName="space-y-3 p-4"
                actions={
                  <Button size="sm" variant="outline" asChild>
                    <Link
                      to="/sessoes/$sessionId"
                      params={{ sessionId: active.id } as any}
                      search={{} as any}
                    >
                      Abrir sessão
                    </Link>
                  </Button>
                }
                className={undefined}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {active.driverName ?? "Motorista não identificado"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {active.vehicleLabel ?? "Veículo não registrado"}
                      {active.plate ? ` · ${active.plate}` : ""}
                    </p>
                    <p className="tabular mt-1 text-[11px] text-muted-foreground">
                      {active.address ?? "Endereço não registrado"}
                    </p>
                  </div>
                  <ul className="grid grid-cols-2 gap-1.5 text-[11px]">
                    {(
                      [
                        ["CAM", active.sensors.camera],
                        ["AUD", active.sensors.audio],
                        ["GPS", active.sensors.gps],
                        ["NET", active.sensors.network],
                      ] as Array<[string, SensorState]>
                    ).map(([label, state]) => (
                      <li
                        key={label}
                        className={cn(
                          "rounded border px-2 py-1",
                          state === "ativo"
                            ? "border-primary/50 text-primary"
                            : state === "inativo"
                              ? "border-critical/50 text-critical"
                              : "border-border text-muted-foreground",
                        )}
                      >
                        {label}:{" "}
                        {state === "ativo" ? "ok" : state === "inativo" ? "falha" : "sem dado"}
                      </li>
                    ))}
                  </ul>
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
