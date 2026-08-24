import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Settings,
  ShieldCheck,
  RotateCcw,
  Save,
  ChevronRight,
  Volume2,
  ExternalLink,
  Lock,
  Clock,
  HardDrive,
  Eye,
  AlertCircle,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { KirvraAppShell } from "@/components/kirvra/app-shell";
import {
  PageHeader,
  Panel,
  StatusBadge,
  LoadingState,
  ErrorState,
  PermissionDeniedState,
  PendingIntegrationNotice,
} from "@/components/kirvra/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RequirePermission } from "@/components/kirvra/access-control";
import {
  SettingsService,
  SystemSettings,
  Protocol,
  IntegrationStatus,
} from "@/services/settings-service";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_central/configuracoes")({
  component: () => (
    <RequirePermission permissions={["settings.manage"]}>
      <SettingsPage />
    </RequirePermission>
  ),
});

function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<SystemSettings | null>(null);
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [status, setStatus] = useState<IntegrationStatus>("pending");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null);

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsRes, protocolsRes] = await Promise.all([
        SettingsService.getSettings(),
        SettingsService.getProtocols(),
      ]);

      setSettings(settingsRes.settings);
      setOriginalSettings(settingsRes.settings);
      setProtocols(protocolsRes.protocols);
      setStatus(settingsRes.status);
    } catch (err) {
      toast.error("Erro ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSave = async () => {
    if (!settings) return;

    // Validação Atenção < Suspeito < Crítico
    if (
      settings.riskLevels.attention >= settings.riskLevels.suspicious ||
      settings.riskLevels.suspicious >= settings.riskLevels.critical
    ) {
      toast.error(
        "Validação falhou: Os níveis de risco devem seguir a ordem Atenção < Suspeito < Crítico.",
      );
      return;
    }

    setSaving(true);
    try {
      const res = await SettingsService.updateSettings(settings);
      if (res.success) {
        setOriginalSettings(settings);
        toast.success("Configurações salvas com sucesso.");
      } else {
        toast.error(res.error || "Falha ao salvar configurações.");
      }
    } catch (err) {
      toast.error("Erro técnico ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setSettings(originalSettings);
    toast.info("Alterações descartadas.");
  };

  if (loading) {
    return (
      <KirvraAppShell title="Configurações">
        <LoadingState label="Carregando parâmetros da Central..." />
      </KirvraAppShell>
    );
  }

  if (status === "pending" || !settings) {
    return (
      <KirvraAppShell title="Configurações">
        <div className="space-y-6">
          <PageHeader
            title="Parâmetros da Central"
            description="Protocolos, riscos, retenção e comportamento dos alertas."
          />
          <ErrorState
            title="Configuração do backend pendente"
            description="As tabelas 'central_settings' e 'central_protocols' ou as RPCs necessárias não foram encontradas no Supabase VYRA2."
            action={
              <Button onClick={() => window.location.reload()} variant="outline">
                Tentar novamente
              </Button>
            }
          />
        </div>
      </KirvraAppShell>
    );
  }

  return (
    <KirvraAppShell title="Configurações">
      <div className="space-y-6 pb-20">
        <PageHeader
          title="Parâmetros da Central"
          description="Protocolos, riscos, retenção e comportamento dos alertas."
          actions={
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleDiscard}
                disabled={!hasChanges || saving}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Descartar alterações
              </Button>
              <Button
                size="sm"
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleSave}
                disabled={!hasChanges || saving}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Salvar configurações
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Níveis de Risco */}
          <Panel
            title="Níveis de risco"
            description="Limites de pontuação para classificação automática."
          >
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="risk-attention">Atenção a partir de</Label>
                  <div className="relative">
                    <Input
                      id="risk-attention"
                      type="number"
                      value={settings.riskLevels.attention}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          riskLevels: {
                            ...settings.riskLevels,
                            attention: parseInt(e.target.value) || 0,
                          },
                        })
                      }
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="risk-suspicious">Suspeito a partir de</Label>
                  <div className="relative">
                    <Input
                      id="risk-suspicious"
                      type="number"
                      value={settings.riskLevels.suspicious}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          riskLevels: {
                            ...settings.riskLevels,
                            suspicious: parseInt(e.target.value) || 0,
                          },
                        })
                      }
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="risk-critical">Crítico a partir de</Label>
                  <div className="relative">
                    <Input
                      id="risk-critical"
                      type="number"
                      value={settings.riskLevels.critical}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          riskLevels: {
                            ...settings.riskLevels,
                            critical: parseInt(e.target.value) || 0,
                          },
                        })
                      }
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="auto-escalation">Tempo de escalada automática</Label>
                  <div className="relative">
                    <Input
                      id="auto-escalation"
                      type="number"
                      value={settings.riskLevels.autoEscalationSeconds}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          riskLevels: {
                            ...settings.riskLevels,
                            autoEscalationSeconds: parseInt(e.target.value) || 0,
                          },
                        })
                      }
                      className="pr-16"
                    />
                    <span className="absolute right-3 top-2.5 text-[10px] text-muted-foreground">
                      segundos
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          {/* Alertas */}
          <Panel title="Alertas" description="Interface e comportamento do painel operacional.">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Som em alertas críticos</Label>
                  <p className="text-xs text-muted-foreground">
                    Reproduzir sinal sonoro ao detectar risco crítico.
                  </p>
                </div>
                <Switch
                  checked={settings.alertBehavior.soundOnCritical}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      alertBehavior: { ...settings.alertBehavior, soundOnCritical: checked },
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    Abrir alerta crítico automaticamente
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Focar na tela de monitoramento ao surgir risco crítico.
                  </p>
                </div>
                <Switch
                  checked={settings.alertBehavior.autoOpenCritical}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      alertBehavior: { ...settings.alertBehavior, autoOpenCritical: checked },
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    Exigir confirmação para encerramento
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Obrigatório preencher motivo ao descartar alertas.
                  </p>
                </div>
                <Switch
                  checked={settings.alertBehavior.requireConfirmationToClose}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      alertBehavior: {
                        ...settings.alertBehavior,
                        requireConfirmationToClose: checked,
                      },
                    })
                  }
                />
              </div>
            </div>
          </Panel>

          {/* Retenção */}
          <Panel
            title="Retenção de evidências"
            description="Políticas de armazenamento e segurança de dados."
          >
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Retenção de imagens, áudio e vídeo</Label>
                  <Select
                    value={String(settings.retentionPolicy.evidenceRetentionDays)}
                    onValueChange={(v) =>
                      setSettings({
                        ...settings,
                        retentionPolicy: {
                          ...settings.retentionPolicy,
                          evidenceRetentionDays: parseInt(v),
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 dias</SelectItem>
                      <SelectItem value="15">15 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="90">90 dias</SelectItem>
                      <SelectItem value="365">1 ano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Retenção de registros de auditoria</Label>
                  <Select
                    value={String(settings.retentionPolicy.auditRetentionDays)}
                    onValueChange={(v) =>
                      setSettings({
                        ...settings,
                        retentionPolicy: {
                          ...settings.retentionPolicy,
                          auditRetentionDays: parseInt(v),
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="90">90 dias</SelectItem>
                      <SelectItem value="180">180 dias</SelectItem>
                      <SelectItem value="365">1 ano</SelectItem>
                      <SelectItem value="1825">5 anos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Bloquear download por padrão</Label>
                  <p className="text-xs text-muted-foreground">
                    Evidências não podem ser baixadas sem permissão específica.
                  </p>
                </div>
                <Switch
                  checked={settings.retentionPolicy.blockDownloadByDefault}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      retentionPolicy: {
                        ...settings.retentionPolicy,
                        blockDownloadByDefault: checked,
                      },
                    })
                  }
                />
              </div>
            </div>
          </Panel>

          {/* Protocolos */}
          <Panel
            title="Protocolos"
            description="Ações padronizadas para cada tipo de ameaça detectada."
            bodyClassName="p-0"
          >
            <div className="divide-y divide-border">
              {protocols.length > 0 ? (
                protocols.map((protocol) => (
                  <div
                    key={protocol.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg border bg-surface text-muted-foreground",
                          protocol.is_active ? "text-primary" : "opacity-40",
                        )}
                      >
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <p
                          className={cn(
                            "text-sm font-medium",
                            !protocol.is_active && "text-muted-foreground",
                          )}
                        >
                          {protocol.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <StatusBadge
                            tone={protocol.is_active ? "success" : "neutral"}
                            dot={false}
                          >
                            {protocol.is_active ? "Ativo" : "Inativo"}
                          </StatusBadge>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-primary hover:text-primary hover:bg-primary/5"
                      onClick={() => setEditingProtocol(protocol)}
                    >
                      Editar
                    </Button>
                  </div>
                ))
              ) : (
                <div className="p-10 text-center opacity-50">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs">Nenhum protocolo configurado no VYRA2.</p>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      {/* Modal de Edição de Protocolo */}
      <Dialog open={!!editingProtocol} onOpenChange={(open) => !open && setEditingProtocol(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Protocolo</DialogTitle>
            <DialogDescription>
              Ajuste o comportamento e status do protocolo selecionado.
            </DialogDescription>
          </DialogHeader>
          {editingProtocol && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Código</Label>
                <Input id="code" value={editingProtocol.code} readOnly className="bg-muted/50" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Nome do protocolo</Label>
                <Input
                  id="name"
                  value={editingProtocol.name}
                  onChange={(e) =>
                    setEditingProtocol({
                      ...editingProtocol,
                      name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Descrição funcional</Label>
                <textarea
                  id="description"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={editingProtocol.description || ""}
                  onChange={(e) =>
                    setEditingProtocol({
                      ...editingProtocol,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="protocol-active">Status do protocolo</Label>
                <Switch
                  id="protocol-active"
                  checked={editingProtocol.is_active}
                  onCheckedChange={(checked) =>
                    setEditingProtocol({
                      ...editingProtocol,
                      is_active: checked,
                    })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProtocol(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={async () => {
                if (!editingProtocol) return;
                const res = await SettingsService.updateProtocol(editingProtocol.id, {
                  name: editingProtocol.name,
                  description: editingProtocol.description,
                  is_active: editingProtocol.is_active,
                });
                if (res.success) {
                  toast.success("Protocolo atualizado com sucesso.");
                  setProtocols(
                    protocols.map((p) => (p.id === editingProtocol.id ? editingProtocol : p)),
                  );
                  setEditingProtocol(null);
                } else {
                  toast.error(res.error || "Erro ao salvar protocolo.");
                }
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </KirvraAppShell>
  );
}
