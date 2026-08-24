import { getVyraClient } from "@/integrations/vyra/client";
import { Database } from "@/integrations/vyra/types";

export interface RiskLevels {
  attention: number;
  suspicious: number;
  critical: number;
  autoEscalationSeconds: number;
}

export interface AlertBehavior {
  soundOnCritical: boolean;
  autoOpenCritical: boolean;
  requireConfirmationToClose: boolean;
}

export interface RetentionPolicy {
  evidenceRetentionDays: number;
  auditRetentionDays: number;
  blockDownloadByDefault: boolean;
}

export interface Protocol {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  description: string | null;
  sort_order: number;
}

export interface SystemSettings {
  riskLevels: RiskLevels;
  alertBehavior: AlertBehavior;
  retentionPolicy: RetentionPolicy;
}

export type IntegrationStatus = "connected" | "pending" | "error";

export class SettingsService {
  /**
   * Obtém as configurações atuais do sistema.
   * Se as tabelas não existirem, retorna IntegrationStatus="pending".
   */
  static async getSettings(): Promise<{
    settings: SystemSettings | null;
    status: IntegrationStatus;
  }> {
    const client = getVyraClient();
    if (!client) return { settings: null, status: "pending" };

    try {
      const { data, error } = await client
        .from("central_settings")
        .select("*")
        .eq("id", 1)
        .single();

      if (error) {
        console.error("Erro ao carregar configurações:", error);
        return { settings: null, status: "pending" };
      }

      return {
        settings: {
          riskLevels: {
            attention: data.risk_attention_threshold,
            suspicious: data.risk_suspicious_threshold,
            critical: data.risk_critical_threshold,
            autoEscalationSeconds: data.auto_escalation_seconds,
          },
          alertBehavior: {
            soundOnCritical: data.sound_on_critical,
            autoOpenCritical: data.auto_open_critical,
            requireConfirmationToClose: data.require_close_confirmation,
          },
          retentionPolicy: {
            evidenceRetentionDays: data.evidence_retention_days,
            auditRetentionDays: data.audit_retention_days,
            blockDownloadByDefault: data.block_download_by_default,
          },
        },
        status: "connected",
      };
    } catch (e) {
      return { settings: null, status: "pending" };
    }
  }

  static async getProtocols(): Promise<{ protocols: Protocol[]; status: IntegrationStatus }> {
    const client = getVyraClient();
    if (!client) return { protocols: [], status: "pending" };

    try {
      const { data, error } = await client
        .from("central_protocols")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) {
        return { protocols: [], status: "pending" };
      }

      return { protocols: data as Protocol[], status: "connected" };
    } catch (e) {
      return { protocols: [], status: "pending" };
    }
  }

  static async updateSettings(
    settings: SystemSettings,
  ): Promise<{ success: boolean; error?: string }> {
    const client = getVyraClient();
    if (!client) return { success: false, error: "Integração pendente" };

    try {
      const { error } = await client.rpc("central_save_settings", {
        p_risk_attention_threshold: settings.riskLevels.attention,
        p_risk_suspicious_threshold: settings.riskLevels.suspicious,
        p_risk_critical_threshold: settings.riskLevels.critical,
        p_auto_escalation_seconds: settings.riskLevels.autoEscalationSeconds,
        p_sound_on_critical: settings.alertBehavior.soundOnCritical,
        p_auto_open_critical: settings.alertBehavior.autoOpenCritical,
        p_require_close_confirmation: settings.alertBehavior.requireConfirmationToClose,
        p_evidence_retention_days: settings.retentionPolicy.evidenceRetentionDays,
        p_audit_retention_days: settings.retentionPolicy.auditRetentionDays,
        p_block_download_by_default: settings.retentionPolicy.blockDownloadByDefault,
      });

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  static async updateProtocol(
    id: string,
    updates: { name: string; description: string | null; is_active: boolean },
  ): Promise<{ success: boolean; error?: string }> {
    const client = getVyraClient();
    if (!client) return { success: false, error: "Integração pendente" };

    try {
      const { error } = await client.rpc("central_update_protocol", {
        p_protocol_id: id,
        p_name: updates.name,
        p_description: updates.description,
        p_is_active: updates.is_active,
      });

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
