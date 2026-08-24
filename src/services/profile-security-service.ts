import { z } from "zod";
import { getVyraClient } from "@/integrations/vyra/client";

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(1, "Nome é obrigatório"),
  employee_code: z.string(),
  phone: z.string().nullable(),
  avatar_url: z.string().nullable(),
  email: z.string().email(),
  role_name: z.string().nullable(),
  shift_name: z.string().nullable(),
});

export type ProfileData = z.infer<typeof ProfileSchema>;

export interface UpdateProfileResult {
  success: boolean;
  message: string;
  pendingBackend?: boolean;
}

/**
 * Serviço de Perfil e Segurança - Integração Real com Supabase VYRA2.
 */
export const profileSecurityService = {
  /**
   * Obtém o perfil completo do usuário logado.
   */
  async getMyProfile(): Promise<ProfileData> {
    const supabase = getVyraClient();
    if (!supabase) throw new Error("Integração pendente");

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Usuário não autenticado");

    // 1. Perfil básico
    const { data: profile, error: profileError } = await supabase
      .from("central_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Perfil não encontrado");

    // 2. Cargo
    const { data: userRole } = await supabase
      .from("central_user_roles")
      .select("central_roles(name)")
      .eq("user_id", user.id)
      .single();

    // 3. Turno Atual
    const { data: shiftAssignment } = await supabase
      .from("central_shift_assignments")
      .select("central_shifts(name)")
      .eq("operator_id", user.id)
      .eq("date", new Date().toISOString().split('T')[0])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return {
      id: user.id,
      full_name: profile.full_name,
      employee_code: profile.employee_code,
      phone: profile.phone,
      avatar_url: profile.avatar_url,
      email: user.email || "",
      role_name: (userRole?.central_roles as any)?.name || "Colaborador",
      shift_name: (shiftAssignment?.central_shifts as any)?.name || "Não atribuído",
    };
  },

  /**
   * Atualiza o próprio perfil (nome e telefone).
   * Note: central_profiles no VYRA2 ainda não possui política de UPDATE para o próprio usuário.
   * Recomendado implementar RPC: `central_update_own_profile(p_full_name text, p_phone text)`
   */
  async updateProfile(id: string, fullName: string, phone: string | null): Promise<UpdateProfileResult> {
    // Verificamos se existe a RPC ou política de escrita. 
    // Por segurança e conforme instrução, bloqueamos escrita direta insegura.
    return {
      success: false,
      message: "Backend de atualização de perfil pendente",
      pendingBackend: true
    };
  },

  /**
   * Altera a senha do usuário via Supabase Auth.
   */
  async changePassword(password: string): Promise<{ success: boolean; message: string }> {
    const supabase = getVyraClient();
    if (!supabase) throw new Error("Integração pendente");

    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { success: false, message: error.message };

    return { success: true, message: "Senha alterada com sucesso" };
  },

  /**
   * Lista fatores de MFA.
   */
  async listMfaFactors() {
    const supabase = getVyraClient();
    if (!supabase) throw new Error("Integração pendente");

    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    return data;
  },

  /**
   * Encerrar outras sessões ativas.
   */
  async signOutOthers(): Promise<{ success: boolean; message: string }> {
    const supabase = getVyraClient();
    if (!supabase) throw new Error("Integração pendente");

    const { error } = await supabase.auth.signOut({ scope: 'others' });
    if (error) return { success: false, message: error.message };

    return { success: true, message: "Outras sessões encerradas com sucesso" };
  },
  
  /**
   * Obtém a sessão atual.
   */
  async getCurrentSession() {
    const supabase = getVyraClient();
    if (!supabase) throw new Error("Integração pendente");

    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  }
};
