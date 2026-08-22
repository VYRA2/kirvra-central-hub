import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Maximize2, Minimize2, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { KirvraAppShell } from "@/components/kirvra/app-shell";
import { FilterBar, FilterField } from "@/components/kirvra/data-display";
import { LiveMapPanel } from "@/components/kirvra/map-panel";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  RealtimeIndicator,
  RiskBadge,
  StatusBadge,
} from "@/components/kirvra/primitives";
import { formatElapsed } from "@/lib/kirvra-format";
import {
  DEFAULT_MONITORING_FILTERS,
  listLiveSessions,
  subscribeMonitoring,
  type MonitoringFilters,
} from "@/services/monitoring-service";
import { operators } from "@/mocks/kirvra-central";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_central/monitoramento")({
  component: MonitoringPage,
});

function MonitoringPage() {
  const [filters, setFilters] = useState<MonitoringFilters>(
    DEFAULT_MONITORING_FILTERS,
  );
  const [selectedId, setSelectedId] = useState<string | null>("ses-1042");
  const [fullscreen, setFullscreen] = useState(false);

  const realtime = useMemo(() => subscribeMonitoring(() => {}), []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["live-sessions", filters],
    queryFn: () => listLiveSessions(filters),
  });

  const rows = data ?? [];
  const selected = rows.find((row) => row.session.id === selectedId) ?? null;
  const criticalCount = rows.filter(
    (row) => row.session.riskLevel === "critico",
  ).length;

  return (
    <KirvraAppShell title="Monitoramento ao vivo">
      <PageHeader
        title="Motoristas protegidos"
        description="Localização, nível de risco e conectividade das sessões em execução, atualizados continuamente pela Central."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setFullscreen((value) => !value)}
              aria-pressed={fullscreen}
            >
              {fullscreen ? (
                <Minimize2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              )}
              {fullscreen ? "Sair da tela cheia" : "Tela cheia"}
            </Button>
            <Button variant="destructive" asChild>
              <Link to="/alertas" search={{} as any} {...({} as any)}>
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                Alertas críticos · {criticalCount}
              </Link>
            </Button>
          </>
        }
      />

      <FilterBar>
        <FilterField label="Buscar" htmlFor="search" className="min-w-[240px]">
          <Input
            id="search"
            value={filters.search}
            placeholder="Motorista ou placa"
            onChange={(event) =>
              setFilters((f) => ({ ...f, search: event.target.value }))
            }
          />
        </FilterField>

        <FilterField label="Risco" htmlFor="risk">
          <Select
            value={filters.risk}
            onValueChange={(value) =>
              setFilters((f) => ({
                ...f,
                risk: value as MonitoringFilters["risk"],
              }))
            }
          >
            <SelectTrigger id="risk">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os níveis</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="atencao">Atenção</SelectItem>
              <SelectItem value="suspeito">Suspeito</SelectItem>
              <SelectItem value="critico">Crítico</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Operador" htmlFor="operator">
          <Select
            value={filters.operatorId}
            onValueChange={(value) =>
              setFilters((f) => ({ ...f, operatorId: value }))
            }
          >
            <SelectTrigger id="operator">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os operadores</SelectItem>
              {operators.map((operator) => (
                <SelectItem key={operator.id} value={operator.id}>
                  {operator.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <div className="flex items-center gap-2 pb-1.5">
          <Switch
            id="only-offline"
            checked={filters.onlyOffline}
            onCheckedChange={(checked) =>
              setFilters((f) => ({ ...f, onlyOffline: checked }))
            }
          />
          <Label htmlFor="only-offline" className="text-xs">
            Somente offline
          </Label>
        </div>

        <div className="ml-auto pb-1.5">
          <RealtimeIndicator
            status={realtime.status}
            lastUpdate={formatElapsed(new Date().toISOString())}
          />
        </div>
      </FilterBar>

      {isLoading ? <LoadingState rows={4} /> : null}
      {isError ? (
        <ErrorState
          action={<Button onClick={() => void refetch()}>Tentar novamente</Button>}
        />
      ) : null}

      {data ? (
        <div
          className={cn(
            "grid gap-4",
            fullscreen ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_340px]",
          )}
        >
          <Panel bodyClassName="p-0" title={undefined} description={undefined} actions={undefined} className={undefined}>
            <LiveMapPanel
              className={cn(
                "rounded-none border-0",
                fullscreen ? "min-h-[calc(100vh-330px)]" : "min-h-[520px]",
              )}
              activeId={selectedId}
              onSelect={setSelectedId}
              track={selected?.session.track ?? undefined}
              markers={rows.map((row) => ({
                id: row.session.id,
                label: row.driverName,
                x: row.session.mapPosition.x,
                y: row.session.mapPosition.y,
                risk: row.session.riskLevel,
                offline: row.session.state === "offline",
              }))}
              overlay={
                selected ? (
                  <div className="absolute top-4 left-4 w-[300px] rounded-lg border border-border bg-card/95 p-3 backdrop-blur-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {selected.driverName}
                        </p>
                        <p className="tabular truncate text-xs text-muted-foreground">
                          {selected.plate}
                        </p>
                      </div>
                      <RiskBadge level={selected.session.riskLevel} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {selected.session.location.address}
                    </p>
                    <p className="tabular mt-1 text-[11px] text-muted-foreground">
                      Último GPS {formatElapsed(selected.session.location.capturedAt)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" asChild>
                        <Link
                          to="/sessoes/$sessionId"
                          params={{ sessionId: selected.session.id } as any}
                        >
                          Acompanhar
                        </Link>
                      </Button>
                      {selected.session.alertIds[0] ? (
                        <Button size="sm" variant="destructive" asChild>
                          <Link
                            to="/alertas/$alertId"
                            params={{ alertId: selected.session.alertIds[0] } as any}
                          >
                            Abrir alerta
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null
              }
            />
          </Panel>

          <Panel
            title="Sessões ativas"
            description={`${rows.length} sessões no filtro atual`}
            bodyClassName="p-0"
            className={fullscreen ? "xl:hidden" : undefined}
            actions={undefined}
          >
            {rows.length === 0 ? (
              <div className="p-4">
                <EmptyState description="Nenhuma sessão corresponde aos filtros selecionados." />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((row) => {
                  const offline = row.session.state === "offline";
                  const stale =
                    Date.now() -
                      new Date(row.session.lastHeartbeatAt).getTime() >
                    60_000;
                  return (
                    <li
                      key={row.session.id}
                      className={cn(
                        "px-4 py-3",
                        selectedId === row.session.id && "bg-surface-raised/60",
                        offline && "opacity-80",
                      )}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setSelectedId(row.session.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {row.driverName}
                            </p>
                            <p className="tabular text-xs text-muted-foreground">
                              {row.plate}
                            </p>
                          </div>
                          <RiskBadge level={row.session.riskLevel} />
                        </div>
                      </button>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="tabular text-[11px] text-muted-foreground">
                          GPS {formatElapsed(row.session.location.capturedAt)}
                        </span>
                        {offline ? (
                          <StatusBadge tone="critical">Offline</StatusBadge>
                        ) : stale ? (
                          <StatusBadge tone="warning">Heartbeat atrasado</StatusBadge>
                        ) : (
                          <StatusBadge tone="success">Conectada</StatusBadge>
                        )}
                        <Button size="sm" variant="outline" asChild>
                          <Link
                            to="/sessoes/$sessionId"
                            params={{ sessionId: row.session.id } as any}
                          >
                            Abrir
                          </Link>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      ) : null}
    </KirvraAppShell>
  );
}
