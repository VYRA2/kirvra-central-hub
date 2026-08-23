import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, 
  Download, 
  UserPlus, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Info, 
  User,
  Mail,
  Phone,
  Shield,
  Key
} from "lucide-react";
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
  BadgeTone,
  MetricCard,
  DriverAvatar
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useDebounce } from "@/hooks/use-debounce";
import { 
  listTeamProfiles, 
  getTeamStats, 
  listRoles, 
  formatLastAccess,
  manageEmployee,
  type TeamProfile 
} from "@/services/team-service";
import { toast } from "sonner";

const searchSchema = z.object({
  search: z.string().optional().catch(""),
  role: z.string().optional().catch("all"),
  status: z.string().optional().catch("all"),
});

export const Route = createFileRoute("/_central/equipe")({
  validateSearch: (search) => searchSchema.parse(search),
  component: TeamPage,
});

function TeamPage() {
  const { search: searchParam, role: roleParam, status: statusParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  
  const [searchTerm, setSearchTerm] = useState(searchParam || "");
  const [selectedRole, setSelectedRole] = useState(roleParam || "all");
  const [selectedStatus, setSelectedStatus] = useState(statusParam || "all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "review">("create");
  const [selectedProfile, setSelectedProfile] = useState<TeamProfile | null>(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  const { data: team = [], isLoading: isListLoading, isError: isListError, refetch: refetchList } = useQuery({
    queryKey: ["team", debouncedSearch, selectedRole, selectedStatus],
    queryFn: () => listTeamProfiles({ 
      search: debouncedSearch, 
      roleId: selectedRole, 
      status: selectedStatus 
    }),
    staleTime: 30000,
  });

  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["team-stats"],
    queryFn: getTeamStats,
    staleTime: 60000,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["central-roles"],
    queryFn: listRoles,
    staleTime: 300000,
  });

  const updateFilters = (newSearch: string, newRole: string, newStatus: string) => {
    void navigate({
      search: (prev) => ({ 
        ...prev, 
        search: newSearch || undefined, 
        role: newRole === "all" ? undefined : newRole,
        status: newStatus === "all" ? undefined : newStatus
      }),
      replace: true,
    });
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    updateFilters(val, selectedRole, selectedStatus);
  };

  const handleRoleChange = (val: string) => {
    setSelectedRole(val);
    updateFilters(debouncedSearch, val, selectedStatus);
  };

  const handleStatusChange = (val: string) => {
    setSelectedStatus(val);
    updateFilters(debouncedSearch, selectedRole, val);
  };

  const handleAction = async () => {
    const res = await manageEmployee();
    toast.info(res.message);
  };

  const columns: Array<TableColumn<TeamProfile>> = [
    {
      key: "employee",
      header: "Funcionário",
      width: "30%",
      render: (p) => (
        <div className="flex items-center gap-3">
          <DriverAvatar initials={p.full_name.slice(0, 2).toUpperCase()} size="md" />
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-semibold text-foreground truncate">{p.full_name}</span>
            <span className="text-xs text-muted-foreground truncate">—</span>
          </div>
        </div>
      ),
    },
    {
      key: "id",
      header: "ID de acesso",
      render: (p) => <span className="font-mono text-xs uppercase tracking-wider">{p.employee_code}</span>,
    },
    {
      key: "role",
      header: "Cargo",
      render: (p) => <span className="text-sm">{p.role_name || "—"}</span>,
    },
    {
      key: "shift",
      header: "Turno",
      render: () => <span className="text-sm text-muted-foreground">—</span>,
    },
    {
      key: "last_access",
      header: "Último acesso",
      render: (p) => <span className="text-sm">{formatLastAccess(p.last_access_at)}</span>,
    },
    {
      key: "status",
      header: "Estado",
      render: (p) => {
        let tone: BadgeTone = "neutral";
        let label = p.status || "—";
        
        if (p.status === "ativo") {
          tone = "success";
          label = "Ativo";
        } else if (p.status === "suspenso") {
          tone = "critical";
          label = "Suspenso";
        }

        return <StatusBadge tone={tone}>{label}</StatusBadge>;
      },
    },
    {
      key: "actions",
      header: "Ação",
      align: "right",
      render: (p) => (
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 text-xs px-3"
          onClick={() => {
            setSelectedProfile(p);
            setModalMode(p.status === "suspenso" ? "review" : "edit");
            setIsModalOpen(true);
          }}
        >
          {p.status === "suspenso" ? "Revisar" : "Editar"}
        </Button>
      ),
    },
  ];

  return (
    <KirvraAppShell title="Equipe">
      <RequirePermission permissions={["employees.manage"]}>
        <div className="flex flex-col gap-6">
          <PageHeader
            title="Funcionários da Central"
            description="Contas, cargos, turnos e estado de acesso."
            actions={
              <Button 
                className="h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => navigate({ to: "/equipe/novo" })}
              >
                <UserPlus className="h-4 w-4" />
                Novo funcionário
              </Button>
            }
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard 
              label="Funcionários ativos" 
              value={stats?.active.toString() || "0"} 
              sublabel="Contas ativas no sistema"
            />
            <MetricCard 
              label="Online agora" 
              value="0" 
              sublabel="Sem dados"
            />
            <MetricCard 
              label="Em atendimento" 
              value="0" 
              sublabel="Sem dados"
            />
            <MetricCard 
              label="Contas suspensas" 
              value={stats?.suspended.toString() || "0"} 
              sublabel="Contas com acesso bloqueado"
              tone={stats?.suspended && stats.suspended > 0 ? "critical" : "neutral"}
            />
          </div>

          <FilterBar>
            <FilterField label="Nome ou ID de funcionário" htmlFor="search" className="flex-1 min-w-[280px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar..."
                  className="pl-9 h-9 border-border bg-background"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
            </FilterField>
            
            <FilterField label="Cargo" htmlFor="role" className="w-[180px]">
              <Select value={selectedRole} onValueChange={handleRoleChange}>
                <SelectTrigger id="role" className="h-9 border-border bg-background">
                  <SelectValue placeholder="Todos os cargos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os cargos</SelectItem>
                  {roles.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Estado" htmlFor="status" className="w-[180px]">
              <Select value={selectedStatus} onValueChange={handleStatusChange}>
                <SelectTrigger id="status" className="h-9 border-border bg-background">
                  <SelectValue placeholder="Todos os estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estados</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="suspenso">Suspenso</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
          </FilterBar>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {isListLoading ? (
              <div className="p-8">
                <LoadingState label="Carregando funcionários..." rows={6} />
              </div>
            ) : isListError ? (
              <div className="p-8">
                <ErrorState 
                  title="Erro ao carregar equipe" 
                  action={<Button onClick={() => refetchList()}>Tentar novamente</Button>} 
                />
              </div>
            ) : (
              <OperationalTable
                columns={columns}
                rows={team}
                rowKey={(p) => p.id}
                caption="Lista de funcionários da Central"
                emptyState={
                  <div className="p-8">
                    <EmptyState 
                      title={debouncedSearch || selectedRole !== "all" || selectedStatus !== "all" ? "Nenhum funcionário encontrado para os filtros" : "Nenhum funcionário cadastrado"} 
                    />
                  </div>
                }
              />
            )}
          </div>
        </div>

        <EmployeeModal 
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          mode={modalMode}
          profile={selectedProfile}
          roles={roles}
          onAction={handleAction}
        />
      </RequirePermission>
    </KirvraAppShell>
  );
}

function EmployeeModal({ 
  open, 
  onOpenChange, 
  mode, 
  profile, 
  roles,
  onAction 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  mode: "create" | "edit" | "review";
  profile: TeamProfile | null;
  roles: any[];
  onAction: () => void;
}) {
  const isCreate = mode === "create";
  const isReview = mode === "review";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-border bg-sidebar p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-sidebar-accent/30">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-widest mb-1">
            <User className="h-3 w-3" />
            Funcionário
          </div>
          <DialogTitle className="text-xl font-bold text-foreground leading-tight">
            {isCreate ? "Novo funcionário" : isReview ? "Revisar acesso" : "Editar funcionário"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isCreate ? "Cadastre uma nova conta na Central KIRVRA." : `Editando perfil de ${profile?.full_name}`}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-xs font-semibold uppercase text-muted-foreground">Nome completo</Label>
              <Input id="full_name" defaultValue={profile?.full_name || ""} disabled={!isCreate && !isReview} className="h-9" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold uppercase text-muted-foreground">E-mail corporativo</Label>
              <Input id="email" defaultValue="" placeholder="—" disabled={!isCreate && !isReview} className="h-9" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-xs font-semibold uppercase text-muted-foreground">Telefone</Label>
              <Input id="phone" defaultValue={profile?.phone ?? undefined} disabled={!isCreate && !isReview} className="h-9" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role" className="text-xs font-semibold uppercase text-muted-foreground">Cargo</Label>
              <Select 
                key={profile?.id || "new"} 
                {...(profile?.role_id ? { defaultValue: profile.role_id } : {})} 
                disabled={!isCreate && !isReview}
              >
                <SelectTrigger id="role" className="h-9">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isCreate && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="pass" className="text-xs font-semibold uppercase text-muted-foreground">Senha temporária</Label>
                <Input id="pass" type="password" placeholder="••••••••" className="h-9" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pass_confirm" className="text-xs font-semibold uppercase text-muted-foreground">Confirmação</Label>
                <Input id="pass_confirm" type="password" placeholder="••••••••" className="h-9" />
              </div>
            </div>
          )}

          {!isCreate && (
            <div className="rounded-md border border-border bg-sidebar-accent/20 p-3 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">ID de acesso</span>
                <span className="font-mono font-medium">{profile?.employee_code}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Último acesso</span>
                <span className="font-medium">{formatLastAccess(profile?.last_access_at ?? null)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Criado em</span>
                <span className="font-medium">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString("pt-BR") : "—"}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <p className="text-[10px] text-center text-muted-foreground italic">
              Operações de salvamento requerem a futura Edge Function administrativa.
            </p>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-sidebar-accent/10">
          <Button variant="ghost" className="h-9" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="h-9" onClick={onAction} disabled>
            {isCreate ? "Criar funcionário" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
