import { getVyraClient } from "@/integrations/vyra/client";
import { Database } from "@/integrations/vyra/types";

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  permission_name: string;
  permission_code: string;
}

export interface RoleWithPermissions {
  id: string;
  name: string;
  code: string;
  description: string | null;
  permissions: RolePermission[];
}

export const listRolesWithPermissions = async (): Promise<RoleWithPermissions[]> => {
  const supabase = getVyraClient();
  if (!supabase) return [];

  const [rolesRes, permissionsRes, rolePermissionsRes] = await Promise.all([
    supabase.from("central_roles").select("*").order("name"),
    supabase.from("central_permissions").select("*"),
    supabase.from("central_role_permissions").select("*")
  ]);

  if (rolesRes.error) throw rolesRes.error;
  if (permissionsRes.error) throw permissionsRes.error;
  if (rolePermissionsRes.error) throw rolePermissionsRes.error;

  const roles = rolesRes.data || [];
  const permissions = permissionsRes.data || [];
  const rolePermissions = rolePermissionsRes.data || [];

  const permissionById = new Map(permissions.map(p => [p.id, p]));

  return roles.map(role => {
    const associatedPermissions = rolePermissions
      .filter(rp => rp.role_id === role.id)
      .map(rp => {
        const p = permissionById.get(rp.permission_id);
        return {
          id: rp.id,
          role_id: rp.role_id,
          permission_id: rp.permission_id,
          permission_name: p?.name || "Desconhecida",
          permission_code: p?.code || "unknown"
        };
      });

    return {
      ...role,
      permissions: associatedPermissions
    };
  });
};

export const createEmployee = async (data: any) => {
  // A criação segura de funcionários exige uma Edge Function administrativa (atômica).
  // Não simular sucesso e não gravar parcialmente no banco público.
  return {
    success: false,
    message: "Provisionamento administrativo ainda não conectado. A criação requer uma Edge Function segura."
  };
};
