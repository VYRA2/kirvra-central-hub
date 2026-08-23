import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { KirvraAppShell } from "@/components/kirvra/app-shell";
import {
  FilterBar,
  FilterField,
  OperationalTable,
  type TableColumn,
} from "@/components/kirvra/data-display";
import { DriverAvatar, PageHeader, StatusBadge } from "@/components/kirvra/primitives";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { drivers, vehicles } from "@/mocks/kirvra-central";
import type { Driver, Vehicle } from "@/integrations/vyra/types";
import { Link } from "@tanstack/react-router";

const driverSearchSchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  subscription: z.string().optional(),
});

export const Route = createFileRoute("/_central/motoristas/")({
  validateSearch: (search) => driverSearchSchema.parse(search),
  component: DriversPage,
});

function DriversPage() {
  const { q, status, subscription } = Route.useSearch();

  const filteredDrivers = drivers.filter((d) => {
    if (q && !d.fullName.toLowerCase().includes(q.toLowerCase())) return false;
    if (status && status !== "all" && d.registrationStatus !== status) return false;
    if (subscription && subscription !== "all" && d.subscriptionStatus !== subscription)
      return false;
    return true;
  });

  const getPrimaryVehicle = (driverId: string): Vehicle | undefined => {
    return vehicles.find((v) => v.driverId === driverId && v.isPrimary);
  };

  const columns: TableColumn<Driver>[] = [
    {
      key: "driver",
      header: "Motorista",
      render: (driver) => (
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
      render: (driver) => (
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
      render: (driver) => {
        const v = getPrimaryVehicle(driver.id);
        if (!v) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="text-[11px] leading-tight">
            <p className="font-medium">
              {v.make} {v.model}
            </p>
            <p className="text-muted-foreground uppercase">{v.plate}</p>
          </div>
        );
      },
    },
    {
      key: "lastProtection",
      header: "Última proteção",
      render: (driver) => (
        <span className="text-xs text-muted-foreground">
          {driver.lastProtectionAt
            ? driver.lastProtectionAt.includes("Ago")
              ? driver.lastProtectionAt
              : "Há pouco"
            : "—"}
        </span>
      ),
    },
    {
      key: "alerts",
      header: "Alertas",
      align: "center",
      render: (driver) => <span className="font-medium text-foreground">{driver.alertCount}</span>,
    },
    {
      key: "status",
      header: "Cadastro",
      render: (driver) => (
        <StatusBadge
          tone={driver.registrationStatus === "verificado" ? "success" : "warning"}
        >
          {driver.registrationStatus === "verificado"
            ? "Verificado"
            : driver.registrationStatus === "suspenso"
              ? "Suspenso"
              : "Em análise"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (driver) => (
        <Button size="sm" variant="outline" asChild>
          <Link
            to="/motoristas/$driverId"
            params={{ driverId: driver.id }}
            search={{}}>
            Abrir perfil
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <KirvraAppShell title="Motoristas">
      <PageHeader
        title="Motoristas cadastrados"
        description="Situação cadastral, assinatura, veículos e histórico."
        actions={<Button variant="outline">Exportar lista</Button>}
      />

      <FilterBar className="mt-2">
        <FilterField label="Buscar" htmlFor="q" className="flex-1 min-w-[240px]">
          <Input id="q" placeholder="Buscar por nome, CPF ou placa..." />
        </FilterField>

        <FilterField label="Todos os status" htmlFor="status">
          <Select defaultValue="all">
            <SelectTrigger id="status" className="h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="verificado">Verificado</SelectItem>
              <SelectItem value="em_analise">Em análise</SelectItem>
              <SelectItem value="suspenso">Suspenso</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Todas as assinaturas" htmlFor="subscription">
          <Select defaultValue="all">
            <SelectTrigger id="subscription" className="h-9">
              <SelectValue placeholder="Assinatura" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as assinaturas</SelectItem>
              <SelectItem value="ativa">Ativa</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      <div className="mt-4 rounded-xl border border-border bg-card shadow-sm">
        <OperationalTable
          caption="Lista de motoristas cadastrados"
          columns={columns}
          rows={filteredDrivers}
          rowKey={(d) => d.id}
        />
      </div>
    </KirvraAppShell>
  );
}
