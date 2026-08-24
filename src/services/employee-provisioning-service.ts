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
    supabase.from("central_roles").select("*").order("hierarchy_level", { ascending: false }),
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

export interface CreateEmployeeData {
  full_name: string;
  employee_code: string;
  phone?: string;
  role_id: string;
  shift?: string;
  start_date: string;
  temp_password?: string;
  require_new_password: boolean;
  is_active: boolean;
}

export const createEmployee = async (data: CreateEmployeeData) => {
  // A criação segura de funcionários exige uma Edge Function administrativa (atômica).
  // Não simular sucesso e não gravar parcialmente no banco público.
  return {
    success: false,
    message: "Provisionamento administrativo ainda não conectado. A criação requer uma Edge Function segura."
  };
};

export const listAllPermissions = async () => {
  const supabase = getVyraClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("central_permissions").select("*").order("name");
  if (error) throw error;
  return data || [];
};

export const listRolePermissionsMap = async () => {
  const supabase = getVyraClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("central_role_permissions").select("*");
  if (error) throw error;
  return data || [];
};

export const manageRoles = async (data: any) => {
  return {
    success: false,
    message: "Gestão de cargos ainda não conectada. A operação requer uma Edge Function segura."
  };
};
