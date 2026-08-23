import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Download, ChevronRight, FileText, CheckCircle2, AlertCircle, XCircle, Info, Car } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";

import { KirvraAppShell } from "@/components/kirvra/app-shell";
import { RequirePermission } from "@/components/kirvra/access-control";
import { 
  PageHeader, 
  LoadingState, 
  EmptyState, 
  ErrorState, 
  StatusBadge, 
  BadgeTone 
} from "@/components/kirvra/primitives";
import { 
  FilterBar, 
  FilterField, 
  OperationalTable, 
  TableColumn 
} from "@/components/kirvra/data-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { 
  listVehicles, 
  exportVehiclesToCSV, 
  formatRelativeSessionDate,
  VehicleRow 
} from "@/services/vehicle-service";
import { useDebounce } from "@/hooks/use-debounce";

const searchSchema = z.object({
  search: z.string().optional().catch(""),
  status: z.string().optional().catch("Todos os estados"),
});

export const Route = createFileRoute("/_central/veiculos")({
  validateSearch: (search) => searchSchema.parse(search),
  component: VehiclesPage,
});

function VehiclesPage() {
  const { search: searchParam, status: statusParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  
  const [searchTerm, setSearchTerm] = useState(searchParam || "");
  const [selectedStatus, setSelectedStatus] = useState(statusParam || "Todos os estados");
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleRow | null>(null);
  const [drawerMode, setDrawerMode] = useState<"view" | "review">("view");

  const debouncedSearch = useDebounce(searchTerm, 300);

  const { data: vehicles = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["vehicles", debouncedSearch, selectedStatus],
    queryFn: () => listVehicles({ search: debouncedSearch, status: selectedStatus }),
    staleTime: 30000,
  });

  const updateFilters = (newSearch: string, newStatus: string) => {
    void navigate({
      search: (prev) => ({ ...prev, search: newSearch || undefined, status: newStatus === "Todos os estados" ? undefined : newStatus }),
      replace: true,
    });
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    updateFilters(val, selectedStatus);
  };

  const handleStatusChange = (val: string) => {
    setSelectedStatus(val);
    updateFilters(debouncedSearch, val);
  };

  const columns: Array<TableColumn<VehicleRow>> = [
    {
      key: "vehicle",
      header: "Veículo",
      render: (v) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-foreground">
            {v.brand} {v.model} {v.year}
          </span>
          <span className="text-xs text-muted-foreground">{v.color}</span>
        </div>
      ),
    },
    {
      key: "plate",
      header: "Placa",
      render: (v) => <span className="font-mono text-xs uppercase tracking-wider">{v.plate}</span>,
    },
    {
      key: "driver",
      header: "Motorista",
      render: (v) => <span className="text-sm">{v.driver_full_name || "Não vinculado"}</span>,
    },
    {
      key: "owner",
      header: "Propriedade",
      render: (v) => {
        const labels: Record<string, string> = {
          self: "Próprio",
          third_party: "Terceiro",
        };
        return <span className="text-sm">{labels[v.owner_type || ""] || "Não informado"}</span>;
      },
    },
    {
      key: "document",
      header: "Documento",
      render: (v) => {
        const status = v.verification_status;
        let tone: BadgeTone = "neutral";
        let label = status || "Pendente";
        let Icon = Info;

        if (status === "verified") {
          tone = "success";
          label = "Verificado";
          Icon = CheckCircle2;
        } else if (status === "pending") {
          tone = "warning";
          label = "Revisão";
          Icon = AlertCircle;
        } else if (status === "rejected") {
          tone = "critical";
          label = "Reprovado";
          Icon = XCircle;
        }

        return (
          <StatusBadge tone={tone}>
            <span className="flex items-center gap-1">
              <Icon className="h-3 w-3" />
              {label}
            </span>
          </StatusBadge>
        );
      },
    },
    {
      key: "last_session",
      header: "Última sessão",
      render: (v) => (
        <span className="text-sm text-muted-foreground">
          {formatRelativeSessionDate(v.last_session_started_at)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Ação",
      align: "right",
      render: (v) => (
        <div className="flex justify-end gap-2">
          {v.verification_status === "pending" ? (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 border-warning/30 bg-warning/5 text-warning hover:bg-warning/10 hover:text-warning"
              onClick={() => {
                setSelectedVehicle(v);
                setDrawerMode("review");
              }}
            >
              Revisar
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
              onClick={() => {
                setSelectedVehicle(v);
                setDrawerMode("view");
              }}
            >
              Abrir
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <KirvraAppShell title="Veículos">
      <RequirePermission permissions={["vehicles.view"]}>
        <div className="flex flex-col gap-6">
          <PageHeader
            title="Veículos cadastrados"
            description="Verificação documental e vínculo com motoristas."
            actions={
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 gap-2"
                onClick={() => exportVehiclesToCSV(vehicles)}
                disabled={vehicles.length === 0}
              >
                <Download className="h-4 w-4" />
                Exportar lista
              </Button>
            }
          />

          <FilterBar>
            <FilterField label="Buscar placa, modelo ou motorista" htmlFor="search" className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
            </FilterField>
            
            <FilterField label="Status" htmlFor="status" className="w-[200px]">
              <Select value={selectedStatus} onValueChange={handleStatusChange}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Todos os estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos os estados">Todos os estados</SelectItem>
                  <SelectItem value="verified">Verificado</SelectItem>
                  <SelectItem value="pending">Revisão</SelectItem>
                  <SelectItem value="rejected">Reprovado</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
          </FilterBar>

          <div className="rounded-lg border border-border bg-card">
            {isLoading ? (
              <div className="p-8">
                <LoadingState label="Carregando veículos..." rows={6} />
              </div>
            ) : isError ? (
              <div className="p-8">
                <ErrorState 
                  title="Erro ao carregar veículos" 
                  action={<Button onClick={() => refetch()}>Tentar novamente</Button>} 
                />
              </div>
            ) : vehicles.length === 0 ? (
              <div className="p-8">
                <EmptyState 
                  title={debouncedSearch || selectedStatus !== "Todos os estados" ? "Nenhum veículo encontrado para os filtros" : "Nenhum veículo cadastrado"} 
                />
              </div>
            ) : (
              <OperationalTable
                columns={columns}
                rows={vehicles}
                rowKey={(v) => v.id}
                caption="Lista de veículos cadastrados"
              />
            )}
          </div>
        </div>

        <VehicleDetailsDrawer 
          vehicle={selectedVehicle} 
          open={!!selectedVehicle} 
          onOpenChange={(open) => !open && setSelectedVehicle(null)}
          mode={drawerMode}
        />
      </RequirePermission>
    </KirvraAppShell>
  );
}

function VehicleDetailsDrawer({ 
  vehicle, 
  open, 
  onOpenChange,
  mode 
}: { 
  vehicle: VehicleRow | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  mode: "view" | "review";
}) {
  if (!vehicle) return null;

  const isReview = mode === "review";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md border-l border-border bg-sidebar p-0 overflow-y-auto">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border bg-sidebar-accent/30">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-widest mb-1">
            <Car className="h-3 w-3" />
            Veículo
          </div>
          <SheetTitle className="text-xl font-bold text-foreground leading-tight">
            {vehicle.brand} {vehicle.model}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            ID: {vehicle.id}
          </SheetDescription>
        </SheetHeader>

        <div className="p-6 space-y-6">
          {isReview && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-warning">Aguardando revisão</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Existem documentos ou informações pendentes de verificação para este veículo.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <DetailItem label="Marca" value={vehicle.brand} />
            <DetailItem label="Modelo" value={vehicle.model} />
            <DetailItem label="Ano" value={vehicle.year?.toString() || null} />
            <DetailItem label="Cor" value={vehicle.color} />
            <DetailItem label="Placa" value={vehicle.plate?.toUpperCase()} className="font-mono" />
            <DetailItem label="RENAVAM" value={vehicle.renavam || "—"} className="font-mono" />
            <DetailItem 
              label="Propriedade" 
              value={vehicle.owner_type === "self" ? "Próprio" : vehicle.owner_type === "third_party" ? "Terceiro" : "Não informado"} 
            />
            <DetailItem label="Motorista" value={vehicle.driver_full_name} />
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Estado e Verificação</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center justify-between p-3 rounded-md bg-surface border border-border">
                <span className="text-xs text-muted-foreground">Status da Verificação</span>
                <StatusBadge 
                  tone={
                    vehicle.verification_status === "verified" ? "success" : 
                    vehicle.verification_status === "pending" ? "warning" : 
                    vehicle.verification_status === "rejected" ? "critical" : "neutral"
                  }
                >
                  {vehicle.verification_status === "verified" ? "Verificado" : 
                   vehicle.verification_status === "pending" ? "Revisão" : 
                   vehicle.verification_status === "rejected" ? "Reprovado" : vehicle.verification_status || "Pendente"}
                </StatusBadge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-md bg-surface border border-border">
                <span className="text-xs text-muted-foreground">Autorização confirmada</span>
                <span className="text-sm font-medium">
                  {vehicle.authorization_confirmed ? "Sim" : "Não"}
                </span>
              </div>
              {vehicle.authorization_confirmed_at && (
                <DetailItem label="Data da autorização" value={new Date(vehicle.authorization_confirmed_at).toLocaleString("pt-BR")} />
              )}
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Documentação</h3>
            <div className="grid grid-cols-2 gap-4">
              <DocumentLink label="Foto do Veículo" path={vehicle.photo_path} />
              <DocumentLink label="CRLV Digital" path={vehicle.crlv_path} />
            </div>
          </div>

          <div className="pt-6 border-t border-border flex flex-col gap-3">
            <p className="text-[11px] text-center text-muted-foreground italic">
              Alteração documental ainda não habilitada para esta conta.
            </p>
            <Button className="w-full" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar detalhes
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailItem({ label, value, className }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn("text-sm font-medium text-foreground", className)}>{value || "—"}</p>
    </div>
  );
}

function DocumentLink({ label, path }: { label: string; path?: string | null }) {
  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-dashed transition-colors",
        path ? "border-primary/40 bg-primary/5 hover:bg-primary/10 cursor-pointer" : "border-border bg-surface opacity-50"
      )}
    >
      <FileText className={cn("h-6 w-6", path ? "text-primary" : "text-muted-foreground")} />
      <span className="text-[10px] font-semibold text-center uppercase tracking-tighter">
        {label}
      </span>
      {!path && <span className="text-[9px] text-muted-foreground">(Não enviado)</span>}
    </div>
  );
}
