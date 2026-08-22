import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
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
import {
  FilterBar,
  FilterField,
  OperationalTable,
} from "@/components/kirvra/data-display";
import {
  DriverAvatar,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
} from "@/components/kirvra/primitives";
import { formatClock, formatDateTime } from "@/lib/kirvra-format";
import {
  DEFAULT_HISTORY_FILTERS,
  exportAlertHistory,
  listAlertHistory,
  type AlertRow,
  type HistoryFilters,
} from "@/services/alert-service";

export const Route = createFileRoute("/_central/historico/alertas")({
  validateSearch: (search: Record<string, unknown>): HistoryFilters => ({
    period: (search["period"] as HistoryFilters["period"]) ?? "30d",
    outcome: (search["outcome"] as HistoryFilters["outcome"]) ?? "todos",
    page: Number(search["page"]) > 0 ? Number(search["page"]) : 1,
    pageSize: DEFAULT_HISTORY_FILTERS.pageSize,
  }),
  component: AlertHistoryPage,
});

const OUTCOME_LABEL = {
  confirmado: "Confirmado",
  falso_positivo: "Falso positivo",
  encerrado: "Encerrado",
} as const;

function AlertHistoryPage() {
  const filters = Route.useSearch();
  const navigate = useNavigate();

  const setSearch = (next: Partial<HistoryFilters>) => {
    void navigate({
      to: "/historico/alertas",
      search: {
        period: next.period ?? filters.period,
        outcome: next.outcome ?? filters.outcome,
        page: next.page ?? 1,
        pageSize: filters.pageSize,
      },
    });
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["alert-history", filters],
    queryFn: () => listAlertHistory(filters),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <KirvraAppShell title="Histórico de alertas">
      <PageHeader
        title="Ocorrências concluídas"
        description="Registro auditável das decisões humanas, evidências analisadas e tempo de resposta de cada ocorrência encerrada."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              void exportAlertHistory().then((result) =>
                toast.warning(result.status === "ok" ? "Exportado" : result.message),
              )
            }
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Exportar relatório
          </Button>
        }
      />

      <FilterBar>
        <FilterField label="Período" htmlFor="period">
          <Select
            value={filters.period}
            onValueChange={(value) =>
              setSearch({ period: value as HistoryFilters["period"] })
            }
          >
            <SelectTrigger id="period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="todos">Todo o histórico</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Resultado" htmlFor="outcome">
          <Select
            value={filters.outcome}
            onValueChange={(value) =>
              setSearch({ outcome: value as HistoryFilters["outcome"] })
            }
          >
            <SelectTrigger id="outcome">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os resultados</SelectItem>
              <SelectItem value="confirmado">Confirmado</SelectItem>
              <SelectItem value="falso_positivo">Falso positivo</SelectItem>
              <SelectItem value="encerrado">Encerrado</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      {isLoading ? <LoadingState rows={5} /> : null}
      {isError ? (
        <ErrorState
          action={<Button onClick={() => void refetch()}>Tentar novamente</Button>}
        />
      ) : null}

      {data ? (
        <Panel bodyClassName="p-0">
          <OperationalTable<AlertRow>
            caption="Histórico de ocorrências concluídas"
            rows={data.rows}
            rowKey={(row) => row.alert.id}
            emptyState={
              <div className="p-4">
                <EmptyState description="Nenhuma ocorrência concluída no período selecionado." />
              </div>
            }
            columns={[
              {
                key: "protocol",
                header: "Protocolo",
                render: (row) => (
                  <span className="tabular text-sm">{row.alert.protocol}</span>
                ),
              },
              {
                key: "date",
                header: "Data e hora",
                render: (row) => (
                  <span className="tabular text-sm text-muted-foreground">
                    {formatDateTime(row.alert.detectedAt)}
                  </span>
                ),
              },
              {
                key: "driver",
                header: "Motorista",
                render: (row) => (
                  <span className="flex items-center gap-2">
                    <DriverAvatar initials={row.driverName.slice(0, 2)} size="sm" />
                    <span className="text-sm">{row.driverName}</span>
                  </span>
                ),
              },
              {
                key: "threat",
                header: "Ameaça",
                render: (row) => (
                  <span className="text-sm">{row.alert.threatType}</span>
                ),
              },
              {
                key: "outcome",
                header: "Resultado",
                render: (row) => {
                  const outcome = row.alert.decision?.outcome;
                  if (!outcome) return <span className="text-sm">—</span>;
                  return (
                    <StatusBadge
                      tone={
                        outcome === "confirmado"
                          ? "critical"
                          : outcome === "falso_positivo"
                            ? "neutral"
                            : "success"
                      }
                    >
                      {OUTCOME_LABEL[outcome]}
                    </StatusBadge>
                  );
                },
              },
              {
                key: "operator",
                header: "Operador",
                render: (row) => (
                  <span className="text-sm text-muted-foreground">
                    {row.alert.assignment.operatorName ?? "—"}
                  </span>
                ),
              },
              {
                key: "time",
                header: "Tempo",
                align: "right",
                render: (row) => (
                  <span className="tabular text-sm">
                    {formatClock(row.alert.detectedAt).slice(0, 5)}
                  </span>
                ),
              },
              {
                key: "action",
                header: "Ação",
                align: "right",
                render: (row) => (
                  <Button size="sm" variant="outline" asChild>
                    <Link
                      to="/alertas/$alertId"
                      params={{ alertId: row.alert.id }}
                    >
                      Abrir
                    </Link>
                  </Button>
                ),
              },
            ]}
          />

          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5">
            <p className="tabular text-xs text-muted-foreground">
              {data.total} ocorrências · página {data.page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={data.page <= 1}
                onClick={() => setSearch({ page: data.page - 1 })}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={data.page >= totalPages}
                onClick={() => setSearch({ page: data.page + 1 })}
              >
                Próxima
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}
    </KirvraAppShell>
  );
}
