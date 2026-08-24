import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { z } from "zod";

import { RequirePermission } from "@/components/kirvra/access-control";
import { KirvraAppShell } from "@/components/kirvra/app-shell";
import {
  FilterBar,
  FilterField,
  OperationalTable,
  type TableColumn,
} from "@/components/kirvra/data-display";
import {
  DriverAvatar,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@/components/kirvra/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import type { DriverRegistrationStatus, SubscriptionStatus } from "@/integrations/vyra/types";
import {
  DEFAULT_DRIVER_FILTERS,
  exportDriversToCsv,
  formatDriverActivityDate,
  listDrivers,
  type DriverRow,
} from "@/services/driver-service";

const driverSearchSchema = z.object({
  q: z.string().optional().catch(""),
  status: z.string().optional().catch("todos"),
  subscription: z.string().optional().catch("todos"),
});

export const Route = createFileRoute("/_central/motoristas/")({
  validateSearch: (search) => driverSearchSchema.parse(search),
  component: DriversPage,
});

function DriversPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [query, setQuery] = useState(search.q ?? "");
  const [status, setStatus] = useState<DriverRegistrationStatus | "todos">(
    (search.status as DriverRegistrationStatus | "todos") ?? "todos",
  );
  const [subscription, setSubscription] = useState<SubscriptionStatus | "todos">(
    (search.subscription as SubscriptionStatus | "todos") ?? "todos",
  );
  const debouncedQuery = useDebounce(query, 300);

  const filters = {
    ...DEFAULT_DRIVER_FILTERS,
    search: debouncedQuery,
    status,
    subscription,
    pageSize: 100,
  };
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["drivers", filters],
    queryFn: () => listDrivers(filters),
    staleTime: 30_000,
  });
  const rows = data?.rows ?? [];

  const syncSearch = (
    nextQuery: string,
    nextStatus: DriverRegistrationStatus | "todos",
    nextSubscription: SubscriptionStatus | "todos",
  ) => {
    void navigate({
      search: {
        q: nextQuery || undefined,
        status: nextStatus === "todos" ? undefined : nextStatus,
        subscription: nextSubscription === "todos" ? undefined : nextSubscription,
      },
      replace: true,
    });
  };

  const columns: Array<TableColumn<DriverRow>> = [
    {
      key: "driver",
      header: "Motorista",
      render: ({ driver }) => (
        <div className="flex items-center gap-2.5">
          <DriverAvatar initials={driver.initials} size="md" />
          <div className="leading-tight">
            <p className="font-semibold text-foreground">{driver.displayName}</p>
            <p className="text-[10px] text-muted-foreground">{driver.phone}</p>
          </div>
        </div>
      ),
    },
    {
      key: "subscription",
      header: "Assinatura",
      render: ({ driver }) => (
        <StatusBadge tone={driver.subscriptionStatus === "ativa" ? "success" : "warning"}>
          {driver.subscriptionStatus === "ativa"
            ? "Ativa"
            : driver.subscriptionStatus === "cancelada"
              ? "Cancelada"
              : "Pendente"}
        </StatusBadge>
      ),
    },
    {
      key: "vehicle",
      header: "Veículo principal",
      render: ({ primaryVehicle }) =>
        primaryVehicle ? (
          <div className="text-[11px] leading-tight">
            <p className="font-medium">
              {primaryVehicle.make} {primaryVehicle.model}
            </p>
            <p className="text-muted-foreground uppercase">{primaryVehicle.plate}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "lastProtection",
      header: "Última proteção",
      render: ({ driver }) => (
        <span className="text-xs text-muted-foreground">
          {formatDriverActivityDate(driver.lastProtectionAt)}
        </span>
      ),
    },
    {
      key: "alerts",
      header: "Alertas",
      align: "center",
      render: ({ driver }) => (
        <span className="font-medium text-foreground">{driver.alertCount}</span>
      ),
    },
    {
      key: "status",
      header: "Cadastro",
      render: ({ driver }) => (
        <StatusBadge
          tone={
            driver.registrationStatus === "verificado"
              ? "success"
              : driver.registrationStatus === "suspenso"
                ? "critical"
                : "warning"
          }
        >
          {driver.registrationStatus === "verificado"
            ? "Verificado"
            : driver.registrationStatus === "suspenso"
              ? "Suspenso"
              : driver.registrationStatus === "em_analise"
                ? "Em análise"
                : "Pendente"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: ({ driver }) => (
        <Button size="sm" variant="outline" asChild>
          <Link to="/motoristas/$driverId" params={{ driverId: driver.id }} search={{}}>
            Abrir perfil
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <KirvraAppShell title="Motoristas">
      <RequirePermission permissions={["drivers.view"]}>
        <PageHeader
          title="Motoristas cadastrados"
          description="Situação cadastral, assinatura, veículos e histórico."
          actions={
            <Button
              variant="outline"
              onClick={() => exportDriversToCsv(rows)}
              disabled={!rows.length}
            >
              <Download className="mr-2 h-4 w-4" /> Exportar lista
            </Button>
          }
        />

        <FilterBar className="mt-2">
          <FilterField label="Buscar" htmlFor="q" className="flex-1 min-w-[240px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="q"
                className="pl-9"
                placeholder="Buscar por nome, CPF ou placa..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  syncSearch(event.target.value, status, subscription);
                }}
              />
            </div>
          </FilterField>

          <FilterField label="Todos os status" htmlFor="status">
            <Select
              value={status}
              onValueChange={(value) => {
                const next = value as DriverRegistrationStatus | "todos";
                setStatus(next);
                syncSearch(query, next, subscription);
              }}
            >
              <SelectTrigger id="status" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="verificado">Verificado</SelectItem>
                <SelectItem value="em_analise">Em análise</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="suspenso">Suspenso</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Todas as assinaturas" htmlFor="subscription">
            <Select
              value={subscription}
              onValueChange={(value) => {
                const next = value as SubscriptionStatus | "todos";
                setSubscription(next);
                syncSearch(query, status, next);
              }}
            >
              <SelectTrigger id="subscription" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as assinaturas</SelectItem>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
        </FilterBar>

        <div className="mt-4 rounded-xl border border-border bg-card shadow-sm">
          {isLoading ? (
            <div className="p-8">
              <LoadingState label="Carregando motoristas..." rows={5} />
            </div>
          ) : isError ? (
            <div className="p-8">
              <ErrorState
                title="Não foi possível carregar os motoristas"
                action={<Button onClick={() => refetch()}>Tentar novamente</Button>}
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8">
              <EmptyState title="Nenhum motorista encontrado" />
            </div>
          ) : (
            <OperationalTable
              caption="Lista de motoristas cadastrados"
              columns={columns}
              rows={rows}
              rowKey={({ driver }) => driver.id}
            />
          )}
        </div>
      </RequirePermission>
    </KirvraAppShell>
  );
}
