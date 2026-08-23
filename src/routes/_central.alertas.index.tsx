import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KirvraAppShell } from "@/components/kirvra/app-shell";
import { FilterBar, FilterField, OperationalTable } from "@/components/kirvra/data-display";
import {
  AlertStateBadge,
  DriverAvatar,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  SeverityBadge,
} from "@/components/kirvra/primitives";
import { formatClock, formatElapsed } from "@/lib/kirvra-format";
import {
  DEFAULT_QUEUE_FILTERS,
  claimAlert,
  listAlertQueue,
  nextUnassignedCritical,
  type AlertQueueFilters,
  type AlertRow,
} from "@/services/alert-service";
import { operators } from "@/mocks/kirvra-central";

export const Route = createFileRoute("/_central/alertas/")({
  validateSearch: (search: Record<string, unknown>): AlertQueueFilters => ({
    severity: (search.severity as AlertSeverity | undefined) || "todos",
    state: (search.state as AlertState | undefined) || "todos",
    operatorId: (search.operatorId as string | undefined) || "todos",
  }),
      typeof search["severidade"] === "string"
        ? (search["severidade"] as AlertQueueFilters["severity"])
        : ("todos" as const),
  }),
  component: AlertQueuePage,
});

function AlertQueuePage() {
  const { severidade } = Route.useSearch();
  const [filters, setFilters] = useState<AlertQueueFilters>({
    ...DEFAULT_QUEUE_FILTERS,
    severity: severidade,
  });
  const [soundOn, setSoundOn] = useState(true);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["alert-queue", filters],
    queryFn: () => listAlertQueue(filters),
  });

  const handleClaim = async (alertId: string) => {
    const result = await claimAlert(alertId);
    if (result.status === "pending") toast.warning(result.message);
    if (result.status === "error") toast.error(result.message);
  };

  const handleNextCritical = async () => {
    const next = nextUnassignedCritical();
    if (!next) {
      toast.info("Nenhum alerta crítico sem responsável na fila.");
      return;
    }
    await handleClaim(next.id);
  };

  const rows = data ?? [];

  return (
    <KirvraAppShell title="Fila de alertas">
      <PageHeader
        title="Alertas da Central"
        description="Fila ordenada por prioridade, tempo de espera e responsável. Cada alerta exige análise humana antes de qualquer decisão."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setSoundOn((value) => !value)}
              aria-pressed={soundOn}
            >
              {soundOn ? (
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <VolumeX className="h-4 w-4" aria-hidden="true" />
              )}
              Som dos alertas: {soundOn ? "ativo" : "silenciado"}
            </Button>
            <Button variant="destructive" onClick={() => void handleNextCritical()}>
              Assumir próximo crítico
            </Button>
          </>
        }
      />

      <FilterBar>
        <FilterField label="Estado" htmlFor="state">
          <Select
            value={filters.state}
            onValueChange={(value) =>
              setFilters((f) => ({
                ...f,
                state: value as AlertQueueFilters["state"],
              }))
            }
          >
            <SelectTrigger id="state">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os estados</SelectItem>
              <SelectItem value="novo">Novo</SelectItem>
              <SelectItem value="assumido">Assumido</SelectItem>
              <SelectItem value="em_analise">Em análise</SelectItem>
              <SelectItem value="confirmado">Confirmado</SelectItem>
              <SelectItem value="falso_positivo">Falso positivo</SelectItem>
              <SelectItem value="encerrado">Encerrado</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Nível" htmlFor="severity">
          <Select
            value={filters.severity}
            onValueChange={(value) =>
              setFilters((f) => ({
                ...f,
                severity: value as AlertQueueFilters["severity"],
              }))
            }
          >
            <SelectTrigger id="severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os níveis</SelectItem>
              <SelectItem value="critico">Crítico</SelectItem>
              <SelectItem value="suspeito">Suspeito</SelectItem>
              <SelectItem value="atencao">Atenção</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Operador" htmlFor="queue-operator">
          <Select
            value={filters.operatorId}
            onValueChange={(value) => setFilters((f) => ({ ...f, operatorId: value }))}
          >
            <SelectTrigger id="queue-operator">
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
      </FilterBar>

      {isLoading ? <LoadingState rows={5} /> : null}
      {isError ? (
        <ErrorState action={<Button onClick={() => void refetch()}>Tentar novamente</Button>} />
      ) : null}

      {data ? (
        <Panel bodyClassName="p-0">
          <OperationalTable<AlertRow>
            caption="Fila de alertas da Central KIRVRA"
            rows={rows}
            rowKey={(row) => row.alert.id}
            rowClassName={(row) => (row.alert.severity === "critico" ? "bg-critical/5" : undefined)}
            emptyState={
              <div className="p-4">
                <EmptyState description="Nenhum alerta corresponde aos filtros selecionados." />
              </div>
            }
            columns={[
              {
                key: "priority",
                header: "Prioridade",
                width: "120px",
                render: (row) => <SeverityBadge severity={row.alert.severity} />,
              },
              {
                key: "driver",
                header: "Motorista",
                render: (row) => (
                  <span className="flex items-center gap-2">
                    <DriverAvatar initials={row.driverName.slice(0, 2)} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{row.driverName}</span>
                      <span className="tabular block text-xs text-muted-foreground">
                        {row.plate}
                      </span>
                    </span>
                  </span>
                ),
              },
              {
                key: "threat",
                header: "Tipo de ameaça",
                render: (row) => (
                  <span>
                    <span className="block text-sm">{row.alert.threatType}</span>
                    <span className="tabular block text-xs text-muted-foreground">
                      Confiança IA {Math.round(row.alert.confidence * 100)}% · revisão humana
                    </span>
                  </span>
                ),
              },
              {
                key: "location",
                header: "Localização",
                render: (row) => (
                  <span className="text-xs text-muted-foreground">{row.alert.locationLabel}</span>
                ),
              },
              {
                key: "waiting",
                header: "Aguardando",
                align: "right",
                render: (row) => (
                  <span className="tabular text-sm">{formatClock(row.alert.waitingSince)}</span>
                ),
              },
              {
                key: "operator",
                header: "Operador",
                render: (row) => (
                  <span className="text-sm text-muted-foreground">
                    {row.alert.assignment.operatorName ?? "Sem responsável"}
                  </span>
                ),
              },
              {
                key: "state",
                header: "Estado",
                render: (row) => <AlertStateBadge state={row.alert.state} />,
              },
              {
                key: "action",
                header: "Ação",
                align: "right",
                render: (row) => (
                  <span className="flex justify-end gap-2">
                    {!row.alert.assignment.operatorId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleClaim(row.alert.id)}
                      >
                        Assumir
                      </Button>
                    ) : null}
                    <Button size="sm" asChild>
                      <Link to="/alertas/$alertId" params={{ alertId: row.alert.id }}>
                        Abrir
                      </Link>
                    </Button>
                  </span>
                ),
              },
            ]}
          />
          <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            Cronômetros atualizados a cada consulta · último alerta detectado{" "}
            {rows[0] ? formatElapsed(rows[0].alert.detectedAt) : "—"}
          </p>
        </Panel>
      ) : null}
    </KirvraAppShell>
  );
}
