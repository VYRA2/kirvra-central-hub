import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Maximize2, Minimize2, ShieldAlert, X, TriangleAlert } from "lucide-react";

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
  DriverAvatar,
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
        className={undefined}
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
          className={undefined}
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
              onSelect={(id: string) => setSelectedId(id)}
              track={selected?.session.track ?? []}
              markers={rows.map((row) => ({
                id: row.session.id,
                label: row.driverName,
                x: row.session.mapPosition.x,
                y: row.session.mapPosition.y,
                risk: row.session.riskLevel,
                offline: row.session.state === "offline",
              }))}
              footer={undefined}
              overlay={
                selected ? (
                  <div className="absolute top-4 left-4 z-10 max-w-[280px]">
                    <div className="rounded-lg border border-border bg-background/95 p-3 shadow-lg backdrop-blur-sm">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">
                          FOCO EM TEMPO REAL
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setSelectedId(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="mb-3 flex items-center gap-3">
                        <DriverAvatar initials={selected.driverName.substring(0, 2)} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-foreground">
                            {selected.driverName}
                          </p>
                          <div className="flex items-center gap-2">
                            <RiskBadge level={selected.session.riskLevel} />
                            <span className="text-[10px] text-muted-foreground uppercase">
                              {selected.session.state}
                            </span>
                          </div>
                        </div>
                      </div>
                      {selected.session.alertIds && selected.session.alertIds.length > 0 ? (
                        <Button
                          size="sm"
                          className="w-full gap-2 bg-critical text-critical-foreground hover:bg-critical/90"
                          asChild
                        >
                          <Link
                            to={"/alertas/$alertId" as any}
                            params={{ alertId: selected.session.alertIds[0] } as any}
                            search={{} as any}
                          >
                            <TriangleAlert className="h-3.5 w-3.5" />
                            Abrir alerta
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : undefined
              }
            />
          </Panel>

          <Panel
            title="Sessões ativas"
            description={`${rows.length} sessões no filtro atual`}
            bodyClassName="p-0"
            className={cn(fullscreen ? "xl:hidden" : undefined)}
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
