import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, 
  RefreshCw,
  Calendar,
  User,
  Activity,
  Box,
  ChevronRight,
  ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { KirvraAppShell } from "@/components/kirvra/app-shell";
import { RequirePermission } from "@/components/kirvra/access-control";
import { 
  FilterBar, 
  FilterField, 
  OperationalTable 
} from "@/components/kirvra/data-display";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
  Panel,
} from "@/components/kirvra/primitives";
import { formatDateTime } from "@/lib/kirvra-format";
import { 
  listAuditLogs, 
  getAuditStats,
  DEFAULT_AUDIT_FILTERS, 
  type AuditFilters, 
  type AuditRow 
} from "@/services/audit-service";

export const Route = createFileRoute("/_central/auditoria")({
  component: () => (
    <RequirePermission permissions={["audit.view"]}>
      <AuditoriaPage />
    </RequirePermission>
  ),
});

function AuditDetailsSheet({ 
  log, 
  open, 
  onOpenChange 
}: { 
  log: AuditRow | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  if (!log) return null;

  const renderJson = (data: any) => {
    if (!data) return <span className="text-muted-foreground">Sem dados</span>;
    return (
      <pre className="max-h-[300px] overflow-auto rounded-md bg-surface-raised p-3 font-mono text-[10px] text-foreground scrollbar-thin scrollbar-thumb-border">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md md:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <SheetTitle>Detalhes da Auditoria</SheetTitle>
          </div>
          <SheetDescription>
            ID do registro: {log.id}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <Panel title="Operador">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">{log.operator_name || "Operador desconhecido"}</p>
                <p className="text-xs text-muted-foreground">Matrícula: {log.operator_code || "—"}</p>
              </div>
            </div>
          </Panel>

          <Panel title="Operação">
            <dl className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <dt className="text-muted-foreground uppercase tracking-wider">Data e Hora</dt>
                <dd className="mt-1 font-medium">{formatDateTime(log.created_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground uppercase tracking-wider">Ação</dt>
                <dd className="mt-1 font-medium capitalize">{log.action}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground uppercase tracking-wider">Entidade</dt>
                <dd className="mt-1 font-medium uppercase">{log.entity_type}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground uppercase tracking-wider">ID do Recurso</dt>
                <dd className="mt-1 font-mono">{log.entity_id || "—"}</dd>
              </div>
            </dl>
          </Panel>

          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estado Anterior</h4>
              {renderJson(log.previous_data)}
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estado Posterior</h4>
              {renderJson(log.next_data)}
            </div>
          </div>

          <Panel title="Origem da Ação">
            <dl className="space-y-3 text-xs">
              <div className="flex justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">Endereço IP</span>
                <span className="font-mono">{log.ip_address || "—"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground">Device / User Agent</span>
                <span className="break-all text-[10px] leading-tight text-muted-foreground/80">
                  {log.user_agent || "—"}
                </span>
              </div>
            </dl>
          </Panel>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AuditoriaPage() {
  const [filters, setFilters] = useState<AuditFilters>(DEFAULT_AUDIT_FILTERS);
  const [selectedLog, setSelectedLog] = useState<AuditRow | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: () => listAuditLogs(filters),
  });

  const { data: stats } = useQuery({
    queryKey: ["audit-stats"],
    queryFn: () => getAuditStats(),
  });

  const { data: profilesData } = useQuery({
    queryKey: ["central-profiles"],
    queryFn: async () => {
      const { getVyraClient } = await import("@/integrations/vyra/client");
      const client = getVyraClient();
      if (!client) return [];
      const { data } = await client.from("central_profiles").select("id, full_name, employee_code");
      return data || [];
    }
  });

  const handleOpenDetails = (log: AuditRow) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  return (
    <KirvraAppShell title="Auditoria">
      <PageHeader
        title="Auditoria"
        description="Todas as operações críticas da Central KIRVRA são registradas para conformidade e segurança."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
            Atualizar
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Eventos Totais" value={String(stats?.total || 0)} />
        <MetricCard label="Últimas 24 horas" value={String(stats?.recent24h || 0)} tone="primary" />
        <MetricCard label="Operadores Ativos" value={String(stats?.uniqueOperators || 0)} tone="success" />
        <MetricCard label="Filtro Ativo" value={filters.action !== "todos" ? "Sim" : "Não"} tone="neutral" />
      </div>

      <FilterBar>
        <FilterField label="Busca" htmlFor="search">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Operador, ID ou Entidade"
              className="pl-8"
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
            />
          </div>
        </FilterField>

        <FilterField label="Operador" htmlFor="operator">
          <Select
            value={filters.operator_id}
            onValueChange={(v) => setFilters(f => ({ ...f, operator_id: v, page: 1 }))}
          >
            <SelectTrigger id="operator">
              <SelectValue placeholder="Todos os operadores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os operadores</SelectItem>
              {profilesData?.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name} ({p.employee_code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Ação" htmlFor="action">
          <Select
            value={filters.action}
            onValueChange={(v) => setFilters(f => ({ ...f, action: v, page: 1 }))}
          >
            <SelectTrigger id="action">
              <SelectValue placeholder="Todas as ações" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as ações</SelectItem>
              <SelectItem value="create">Criação</SelectItem>
              <SelectItem value="update">Edição</SelectItem>
              <SelectItem value="delete">Exclusão</SelectItem>
              <SelectItem value="login">Acesso</SelectItem>
              <SelectItem value="export">Exportação</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Entidade" htmlFor="entity">
          <Select
            value={filters.entity_type}
            onValueChange={(v) => setFilters(f => ({ ...f, entity_type: v, page: 1 }))}
          >
            <SelectTrigger id="entity">
              <SelectValue placeholder="Todas as entidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as entidades</SelectItem>
              <SelectItem value="alerts">Alertas</SelectItem>
              <SelectItem value="drivers">Motoristas</SelectItem>
              <SelectItem value="profiles">Operadores</SelectItem>
              <SelectItem value="evidence">Evidências</SelectItem>
              <SelectItem value="roles">Cargos</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      {isLoading ? <LoadingState rows={10} /> : null}
      {isError ? (
        <ErrorState
          action={<Button onClick={() => void refetch()}>Tentar novamente</Button>}
        />
      ) : null}

      {!isLoading && !isError && data ? (
        <Panel bodyClassName="p-0">
          <OperationalTable<AuditRow>
            caption="Registro de auditoria do sistema"
            rows={data.rows}
            rowKey={(row) => row.id}
            emptyState={
              <div className="p-8">
                <EmptyState description="Nenhum registro de auditoria encontrado." />
              </div>
            }
            columns={[
              {
                key: "created",
                header: "Data e Hora",
                width: "180px",
                render: (row) => (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="tabular text-xs">
                      {formatDateTime(row.created_at)}
                    </span>
                  </div>
                ),
              },
              {
                key: "operator",
                header: "Operador",
                render: (row) => (
                  <div>
                    <div className="text-sm font-medium">{row.operator_name || "Desconhecido"}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{row.operator_code || "—"}</div>
                  </div>
                ),
              },
              {
                key: "action",
                header: "Ação",
                render: (row) => (
                  <div className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-primary" />
                    <span className="capitalize">{row.action}</span>
                  </div>
                ),
              },
              {
                key: "entity",
                header: "Entidade",
                render: (row) => (
                  <div className="flex items-center gap-2">
                    <Box className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="uppercase text-[10px] font-semibold tracking-wider">{row.entity_type}</span>
                  </div>
                ),
              },
              {
                key: "entity_id",
                header: "ID Recurso",
                render: (row) => (
                  <span className="font-mono text-[10px] text-muted-foreground truncate block max-w-[120px]">
                    {row.entity_id || "—"}
                  </span>
                ),
              },
              {
                key: "action_btn",
                header: "Ação",
                align: "right",
                render: (row) => (
                  <Button variant="ghost" size="sm" onClick={() => handleOpenDetails(row)} className="text-primary hover:text-primary-foreground">
                    Ver detalhes
                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                ),
              },
            ]}
          />
          
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Mostrando {data.rows.length} de {data.count} logs
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={filters.page === 1}
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={filters.page * filters.pageSize >= data.count}
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
              >
                Próxima
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      <AuditDetailsSheet 
        log={selectedLog} 
        open={detailsOpen} 
        onOpenChange={setDetailsOpen} 
      />
    </KirvraAppShell>
  );
}
