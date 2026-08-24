import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { 
  Shield, 
  Check, 
  Minus,
  Plus,
  Save,
  ChevronLeft,
  Lock,
  Info
} from "lucide-react";
import { KirvraAppShell } from "@/components/kirvra/app-shell";
import { RequirePermission } from "@/components/kirvra/access-control";
import { PageHeader, LoadingState, ErrorState } from "@/components/kirvra/primitives";
import { Button } from "@/components/ui/button";
import { 
  listRolesWithPermissions, 
  listAllPermissions, 
  listRolePermissionsMap,
  manageRoles
} from "@/services/employee-provisioning-service";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_central/equipe/cargos-permissoes")({
  component: RolesPermissionsPage,
});

function RolesPermissionsPage() {
  const navigate = useNavigate();

  const { data: roles = [], isLoading: loadingRoles, isError: errorRoles } = useQuery({
    queryKey: ["central-roles-permissions-matrix"],
    queryFn: listRolesWithPermissions,
    staleTime: 300000,
  });

  const { data: allPermissions = [], isLoading: loadingPerms, isError: errorPerms } = useQuery({
    queryKey: ["central-all-permissions"],
    queryFn: listAllPermissions,
    staleTime: 300000,
  });

  const { data: rolePermissions = [], isLoading: loadingMap, isError: errorMap } = useQuery({
    queryKey: ["central-role-permissions-map"],
    queryFn: listRolePermissionsMap,
    staleTime: 300000,
  });

  const isLoading = loadingRoles || loadingPerms || loadingMap;
  const isError = errorRoles || errorPerms || errorMap;

  const handleSave = async () => {
    const res = await manageRoles({});
    toast.error(res.message);
  };

  if (isLoading) return <LoadingState label="Carregando matriz de acesso..." />;
  if (isError) return <ErrorState title="Erro ao carregar permissões do sistema." />;

  return (
    <KirvraAppShell title="Cargos e permissões">
      <RequirePermission permissions={["roles.manage"]}>
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
            <h2 className="text-sm font-medium text-muted-foreground">Cargos e permissões</h2>
          </div>

          <PageHeader
            title="Controle de acesso"
            description="Permissões concedidas por função e protegidas no banco."
            actions={
              <div className="flex gap-3">
                <Button 
                  variant="ghost" 
                  className="text-muted-foreground"
                  disabled
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo cargo
                </Button>
                <Button 
                  onClick={handleSave}
                  className="bg-[#10B981] hover:bg-[#10B981]/90 text-white font-medium px-6"
                  disabled
                >
                  Salvar alterações
                </Button>
              </div>
            }
          />

          <div className="rounded-xl border border-border bg-[#0B1218] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-[#0F1720]/50">
                    <th className="p-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-1/3">
                      Permissão
                    </th>
                    {roles.map((role) => (
                      <th 
                        key={role.id} 
                        className="p-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center min-w-[100px]"
                      >
                        {role.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {allPermissions.length > 0 ? (
                    allPermissions.map((perm) => (
                      <tr key={perm.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-5">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{perm.name}</span>
                            {perm.description && (
                              <span className="text-[10px] text-muted-foreground mt-0.5">{perm.description}</span>
                            )}
                          </div>
                        </td>
                        {roles.map((role) => {
                          const hasPermission = rolePermissions.some(
                            (rp) => rp.role_id === role.id && rp.permission_id === perm.id
                          );
                          return (
                            <td key={`${role.id}-${perm.id}`} className="p-5 text-center">
                              <div className="flex justify-center items-center">
                                {hasPermission ? (
                                  <Check className="h-4 w-4 text-[#10B981]" strokeWidth={3} />
                                ) : (
                                  <Minus className="h-4 w-4 text-muted-foreground/20" />
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={roles.length + 1} className="p-10 text-center text-muted-foreground italic">
                        Nenhuma permissão configurada no sistema.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-border/40 bg-card/30 p-4 flex gap-3 items-start">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[11px] leading-relaxed text-muted-foreground italic">
              Um funcionário não pode conceder permissões superiores às próprias. Apenas o Super Admin pode criar outro Super Admin ou Administrador.
            </p>
          </div>

          <div className="flex justify-center mt-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#10B981]/20 bg-[#10B981]/5 text-[#10B981] text-[10px] font-semibold uppercase tracking-wider">
              <Lock className="h-3 w-3" />
              Gestão de cargos ainda não conectada
            </div>
          </div>
        </div>
      </RequirePermission>
    </KirvraAppShell>
  );
}
