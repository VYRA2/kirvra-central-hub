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
      // Tentamos ler da tabela 'central_settings'.
      // Como sabemos que ela pode não existir ainda no VYRA2, capturamos o erro.
      const { data, error } = await client
        .from("central_settings" as any)
        .select("*")
        .single();

      if (error) {
        console.error("Erro ao carregar configurações:", error);
        return { settings: null, status: "pending" };
      }

      // Mapeamento real para o objeto de interface
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

  /**
   * Obtém a lista de protocolos reais.
   */
  static async getProtocols(): Promise<{ protocols: Protocol[]; status: IntegrationStatus }> {
    const client = getVyraClient();
    if (!client) return { protocols: [], status: "pending" };

    try {
      const { data, error } = await client
        .from("central_protocols" as any)
        .select("*")
        .order("name");

      if (error) {
        return { protocols: [], status: "pending" };
      }

      return { protocols: data as Protocol[], status: "connected" };
    } catch (e) {
      return { protocols: [], status: "pending" };
    }
  }

  /**
   * Salva as configurações.
   */
  static async updateSettings(
    settings: SystemSettings,
  ): Promise<{ success: boolean; error?: string }> {
    const client = getVyraClient();
    if (!client) return { success: false, error: "Integração pendente" };

    const payload = {
      risk_attention_threshold: settings.riskLevels.attention,
      risk_suspicious_threshold: settings.riskLevels.suspicious,
      risk_critical_threshold: settings.riskLevels.critical,
      auto_escalation_seconds: settings.riskLevels.autoEscalationSeconds,
      sound_on_critical: settings.alertBehavior.soundOnCritical,
      auto_open_critical: settings.alertBehavior.autoOpenCritical,
      require_close_confirmation: settings.alertBehavior.requireConfirmationToClose,
      evidence_retention_days: settings.retentionPolicy.evidenceRetentionDays,
      audit_retention_days: settings.retentionPolicy.auditRetentionDays,
      block_download_by_default: settings.retentionPolicy.blockDownloadByDefault,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await client
        .from("central_settings" as any)
        .update(payload)
        .eq("id", 1); // Assume-se um singleton com ID 1

      if (error) throw error;

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Atualiza um protocolo específico.
   */
  static async updateProtocol(
    id: string,
    updates: Partial<Protocol>,
  ): Promise<{ success: boolean; error?: string }> {
    const client = getVyraClient();
    if (!client) return { success: false, error: "Integração pendente" };

    try {
      const { error } = await client
        .from("central_protocols" as any)
        .update(updates)
        .eq("id", id);

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
