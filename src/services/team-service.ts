import { getVyraClient } from "@/integrations/vyra/client";
import { Database } from "@/integrations/vyra/types";

export type TeamProfile = Database["public"]["Tables"]["central_profiles"]["Row"] & {
  role_id: string | null;
  role_name: string | null;
  role_code: string | null;
};

export interface TeamFilters {
  search?: string;
  roleId?: string;
  status?: string;
}

export interface TeamStats {
  active: number;
  online: number;
  inService: number;
  suspended: number;
}

export const listTeamProfiles = async (filters: TeamFilters): Promise<TeamProfile[]> => {
  const supabase = getVyraClient();
  if (!supabase) throw new Error("Supabase client not configured");

  // A consulta real exige join entre central_profiles, central_user_roles e central_roles
  // Como não podemos assumir que o postgrest resolve o join automático sem foreign keys declaradas explicitamente,
  // fazemos o fetch e o join manual para garantir robustez no VYRA2.
  
  const [profilesRes, userRolesRes, rolesRes] = await Promise.all([
    supabase.from("central_profiles").select("*"),
    supabase.from("central_user_roles").select("*"),
    supabase.from("central_roles").select("*")
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (userRolesRes.error) throw userRolesRes.error;
  if (rolesRes.error) throw rolesRes.error;

  const profiles = profilesRes.data || [];
  const userRoles = userRolesRes.data || [];
  const roles = rolesRes.data || [];

  const roleById = new Map(roles.map(r => [r.id, r]));
  const roleByUserId = new Map(userRoles.map(ur => [ur.user_id, roleById.get(ur.role_id)]));

  let processed = profiles.map(p => {
    const role = roleByUserId.get(p.id);
    return {
      ...p,
      role_id: role?.id || null,
      role_name: role?.name || null,
      role_code: role?.code || null
    };
  });

  // Filtros em memória
  if (filters.search) {
    const s = filters.search.toLowerCase();
    processed = processed.filter(p => 
      p.full_name.toLowerCase().includes(s) || 
      p.employee_code.toLowerCase().includes(s)
    );
  }

  if (filters.roleId && filters.roleId !== "all") {
    processed = processed.filter(p => {
      const role = roleByUserId.get(p.id);
      return role?.id === filters.roleId;
    });
  }

  if (filters.status && filters.status !== "all") {
    processed = processed.filter(p => p.status === filters.status);
  }

  return processed;
};

export const getTeamStats = async (): Promise<TeamStats> => {
  const supabase = getVyraClient();
  if (!supabase) return { active: 0, online: 0, inService: 0, suspended: 0 };

  const { data, error } = await supabase.from("central_profiles").select("status");
  if (error) throw error;

  const stats = {
    active: 0,
    online: 0, // Fonte real ainda não disponível
    inService: 0, // Fonte real ainda não disponível
    suspended: 0
  };

  data?.forEach(p => {
    if (p.status === "ativo") stats.active++;
    if (p.status === "suspenso") stats.suspended++;
  });

  return stats;
};

export const listRoles = async () => {
  const supabase = getVyraClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("central_roles").select("*").order("name");
  if (error) throw error;
  return data || [];
};

export const manageEmployee = async () => {
  // Simula a tentativa de chamada à Edge Function administrativa futura
  // Retorna o erro esperado conforme requisitos
  return {
    success: false,
    message: "Provisionamento seguro de funcionários ainda não habilitado."
  };
};

export const formatLastAccess = (dateStr: string | null) => {
  if (!dateStr) return "Nunca";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffMinutes < 1) return "Agora";
  if (diffMinutes < 60) return `Há ${diffMinutes} min`;
  
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  }) + " " + date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
};
