import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { 
  ChevronLeft, 
  Save, 
  X,
  Shield,
  Key,
  Calendar,
  Phone,
  User,
  Info
} from "lucide-react";
import { KirvraAppShell } from "@/components/kirvra/app-shell";
import { RequirePermission } from "@/components/kirvra/access-control";
import { PageHeader, LoadingState, ErrorState } from "@/components/kirvra/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { listRolesWithPermissions, createEmployee } from "@/services/employee-provisioning-service";
import { toast } from "sonner";

export const Route = createFileRoute("/_central/equipe/novo")({
  component: NewEmployeePage,
});

function NewEmployeePage() {
  const navigate = useNavigate();
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  
  const { data: roles = [], isLoading, isError } = useQuery({
    queryKey: ["central-roles-permissions"],
    queryFn: listRolesWithPermissions,
    staleTime: 300000,
  });

  const selectedRole = roles.find(r => r.id === selectedRoleId);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createEmployee({});
    toast.error(res.message);
  };

  return (
    <KirvraAppShell title="Cadastro de funcionário">
      <RequirePermission permissions={["employees.manage"]}>
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate({ to: "/equipe" })}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-sm font-medium text-muted-foreground">Cadastro de funcionário</h2>
          </div>

          <form onSubmit={handleCreate} className="space-y-6">
            <PageHeader
              title="Novo funcionário"
              description="Crie a identidade interna e conceda apenas os acessos necessários."
              actions={
                <div className="flex gap-3">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => navigate({ to: "/equipe" })}
                    className="text-muted-foreground"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled
                  >
                    Criar funcionário
                  </Button>
                </div>
              }
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Identificação */}
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-lg border border-border bg-card p-6 space-y-6">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-widest">
                    <User className="h-3.5 w-3.5" />
                    Identificação
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name" className="text-xs font-semibold uppercase text-muted-foreground">Nome completo</Label>
                      <Input id="full_name" placeholder="Ex: Beatriz Martins" className="h-10 bg-sidebar/50" required />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="employee_code" className="text-xs font-semibold uppercase text-muted-foreground">ID de acesso</Label>
                      <Input id="employee_code" placeholder="Ex: KRV-OP-0051" className="h-10 bg-sidebar/50" required />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-xs font-semibold uppercase text-muted-foreground">Telefone interno</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="phone" placeholder="(11) 4000-0151" className="pl-9 h-10 bg-sidebar/50" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role" className="text-xs font-semibold uppercase text-muted-foreground">Cargo</Label>
                      {isLoading ? (
                        <div className="h-10 w-full animate-pulse bg-muted rounded-md" />
                      ) : (
                        <Select value={selectedRoleId} onValueChange={setSelectedRoleId} required>
                          <SelectTrigger id="role" className="h-10 bg-sidebar/50">
                            <SelectValue placeholder="Selecione um cargo..." />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map(r => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shift" className="text-xs font-semibold uppercase text-muted-foreground">Turno</Label>
                      <Select defaultValue="18h-02h">
                        <SelectTrigger id="shift" className="h-10 bg-sidebar/50">
                          <SelectValue placeholder="Selecione o turno..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="06h-14h">06h–14h</SelectItem>
                          <SelectItem value="14h-22h">14h–22h</SelectItem>
                          <SelectItem value="22h-06h">22h–06h</SelectItem>
                          <SelectItem value="18h-02h">18h–02h</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="start_date" className="text-xs font-semibold uppercase text-muted-foreground">Data de início</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="start_date" type="date" className="pl-9 h-10 bg-sidebar/50" required />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Acesso Inicial */}
              <div className="space-y-6">
                <div className="rounded-lg border border-border bg-card p-6 space-y-6">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-widest">
                    <Key className="h-3.5 w-3.5" />
                    Acesso inicial
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="temp_password" className="text-xs font-semibold uppercase text-muted-foreground">Senha provisória</Label>
                      <Input id="temp_password" type="password" placeholder="••••••••" className="h-10 bg-sidebar/50" required />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-md border border-border bg-sidebar-accent/10">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Exigir nova senha</Label>
                        <p className="text-[10px] text-muted-foreground">Obrigatório no primeiro login</p>
                      </div>
                      <Switch checked />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-md border border-border bg-sidebar-accent/10">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Conta ativa</Label>
                        <p className="text-[10px] text-muted-foreground">Permite login após criação</p>
                      </div>
                      <Switch checked />
                    </div>
                  </div>
                </div>

                {/* Permissões do cargo */}
                <div className="rounded-lg border border-border bg-card p-6 space-y-6">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-widest">
                    <Shield className="h-3.5 w-3.5" />
                    Permissões do cargo
                  </div>

                  <div className="space-y-3">
                    {selectedRole ? (
                      selectedRole.permissions.length > 0 ? (
                        <div className="space-y-2">
                          {selectedRole.permissions.map(p => (
                            <div key={p.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0">
                              <span className="text-muted-foreground capitalize">{p.permission_name}</span>
                              <span className="font-medium text-foreground">Habilitado</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Este cargo não possui permissões associadas.</p>
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center py-4 text-center">
                        <Info className="h-5 w-5 text-muted-foreground/40 mb-2" />
                        <p className="text-xs text-muted-foreground">Selecione um cargo para visualizar as permissões.</p>
                      </div>
                    )}
                  </div>

                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full h-9 text-xs border-border/60"
                    onClick={() => navigate({ to: "/equipe" })} // Placeholder para /equipe/cargos-permissoes
                  >
                    Revisar permissões
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <p className="text-[10px] text-muted-foreground italic max-w-lg text-center">
                Nota: O provisionamento administrativo atômico requer uma Edge Function segura. 
                Atualmente esta funcionalidade está pendente de conexão.
              </p>
            </div>
          </form>
        </div>
      </RequirePermission>
    </KirvraAppShell>
  );
}
