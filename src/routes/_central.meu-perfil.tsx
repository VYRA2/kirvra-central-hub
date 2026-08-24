import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  KeyRound,
  ShieldCheck,
  Smartphone,
  Monitor,
  LogOut,
  Save,
  AlertTriangle,
  QrCode,
  CheckCircle2,
  RefreshCcw,
  Eye,
  EyeOff,
} from "lucide-react";

import { KirvraAppShell } from "@/components/kirvra/app-shell";
import {
  PageHeader,
  Panel,
  DriverAvatar,
  LoadingState,
  ErrorState,
  StatusBadge,
  PendingIntegrationNotice,
} from "@/components/kirvra/primitives";
import { ConfirmActionDialog } from "@/components/kirvra/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { profileSecurityService, type ProfileData } from "@/services/profile-security-service";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Session } from "@supabase/supabase-js";

export const Route = createFileRoute("/_central/meu-perfil")({
  component: ProfileSecurityPage,
});

function ProfileSecurityPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);

  // Modais
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [showSignOutOthersConfirm, setShowSignOutOthersConfirm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [p, s, mfa] = await Promise.all([
        profileSecurityService.getMyProfile(),
        profileSecurityService.getCurrentSession(),
        profileSecurityService.getMfaStatus(),
      ]);
      setProfile(p);
      setSession(s);
      setMfaEnabled(mfa.enabled);
    } catch (err: unknown) {
      console.error("Erro ao carregar perfil:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile() {
    if (!profile) return;
    setSaving(true);
    try {
      const result = await profileSecurityService.updateProfile(
        profile.id,
        profile.full_name,
        profile.phone,
      );
      if (result.success) {
        toast.success(result.message);
      } else if (result.pendingBackend) {
        toast.warning(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <KirvraAppShell title="Meu perfil e segurança">
        <LoadingState label="Carregando seu perfil..." />
      </KirvraAppShell>
    );
  if (error)
    return (
      <KirvraAppShell title="Meu perfil e segurança">
        <ErrorState
          title="Não foi possível carregar seu perfil"
          description={error}
          action={<Button onClick={loadData}>Tentar novamente</Button>}
        />
      </KirvraAppShell>
    );
  if (!profile)
    return (
      <KirvraAppShell title="Meu perfil e segurança">
        <ErrorState title="Perfil não encontrado" />
      </KirvraAppShell>
    );

  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <KirvraAppShell title="Meu perfil e segurança">
      <div className="space-y-6">
        <PageHeader
          title="Meu perfil e segurança"
          description="Gerencie suas informações pessoais, credenciais de acesso e segurança da conta."
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Coluna Esquerda: Informações Pessoais */}
          <div className="lg:col-span-2 space-y-6">
            <Panel title="Informações Pessoais">
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <DriverAvatar
                    initials={initials}
                    size="xl"
                    className="border-4 border-primary/20"
                  />
                  <div className="text-center sm:text-left">
                    <h3 className="text-lg font-semibold">{profile.full_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {profile.role_name} • {profile.employee_code}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Turno: {profile.shift_name}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nome completo</Label>
                    <Input
                      id="full_name"
                      value={profile.full_name}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail corporativo</Label>
                    <Input
                      id="email"
                      value={profile.email}
                      readOnly
                      className="bg-muted/50 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone de contato</Label>
                    <Input
                      id="phone"
                      value={profile.phone || ""}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employee_code">Código interno</Label>
                    <Input
                      id="employee_code"
                      value={profile.employee_code}
                      readOnly
                      className="bg-muted/50 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <Button variant="outline" onClick={loadData} disabled={saving}>
                    Descartar
                  </Button>
                  <Button onClick={handleSaveProfile} disabled={saving}>
                    {saving ? (
                      <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Salvar alterações
                  </Button>
                </div>
              </div>
            </Panel>

            <Panel title="Segurança da Conta">
              <div className="divide-y divide-border">
                {/* Senha */}
                <div className="flex items-center justify-between py-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-medium">Senha de acesso</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Última alteração: Data não disponível
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowPasswordModal(true)}>
                    Alterar
                  </Button>
                </div>

                {/* MFA */}
                <div className="flex items-center justify-between py-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-medium">Autenticação em duas etapas (MFA)</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Adicione uma camada extra de segurança usando o Google Authenticator ou
                      similar.
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge tone={mfaEnabled ? "success" : "neutral"}>
                      {mfaEnabled ? "Ativado" : "Desativado"}
                    </StatusBadge>
                    <Switch
                      checked={mfaEnabled}
                      disabled={mfaEnabled}
                      onCheckedChange={() => setShowMfaModal(true)}
                    />
                  </div>
                </div>

                {/* Sessões */}
                <div className="flex items-center justify-between py-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-medium">Sessões ativas</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {session
                        ? "Sua sessão atual está ativa."
                        : "Nenhuma sessão ativa encontrada."}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowSessionsModal(true)}>
                    Gerenciar
                  </Button>
                </div>
              </div>
            </Panel>
          </div>

          {/* Coluna Direita: Dispositivos */}
          <div className="space-y-6">
            <Panel title="Dispositivos Autorizados" description="Gerenciamento individual pendente">
              <div className="space-y-4">
                <div className="rounded-md border border-border bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <Monitor className="mt-0.5 h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Dispositivo Atual</p>
                      <p className="text-xs text-muted-foreground">
                        {navigator?.userAgent?.split(")")?.[0]?.split("(")?.[1] || "Navegador Web"}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <StatusBadge tone="success">Conectado agora</StatusBadge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center border border-dashed border-border rounded-lg">
                  <Smartphone className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">
                    Nenhum outro dispositivo registrado
                  </p>
                </div>

                <div className="bg-warning/10 border border-warning/30 rounded-md p-3">
                  <div className="flex gap-2 text-warning">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <p className="text-[10px] leading-relaxed">
                      O gerenciamento individual de dispositivos requer uma tabela dedicada no
                      backend. Para encerrar o acesso em outros locais, use o gerenciamento de
                      sessões.
                    </p>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {/* Modais */}
      <PasswordModal open={showPasswordModal} onOpenChange={setShowPasswordModal} />
      <MfaModal open={showMfaModal} onOpenChange={setShowMfaModal} />
      <SessionsModal
        open={showSessionsModal}
        onOpenChange={setShowSessionsModal}
        onSignOutOthers={() => setShowSignOutOthersConfirm(true)}
      />

      <ConfirmActionDialog
        open={showSignOutOthersConfirm}
        onOpenChange={setShowSignOutOthersConfirm}
        title="Encerrar outras sessões?"
        description="Isso fará com que todos os outros dispositivos conectados, exceto este, sejam desconectados imediatamente."
        confirmLabel="Encerrar sessões"
        onConfirm={async () => {
          const res = await profileSecurityService.signOutOthers();
          if (res.success) toast.success(res.message);
          else toast.error(res.message);
          return { status: res.success ? "ok" : "error", message: res.message };
        }}
        destructive
      />
    </KirvraAppShell>
  );
}

function PasswordModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}): React.JSX.Element {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleUpdate() {
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres");
      return;
    }

    setLoading(true);
    try {
      const res = await profileSecurityService.changePassword(newPassword);
      if (res.success) {
        toast.success(res.message);
        onOpenChange(false);
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(res.message);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar senha de acesso</DialogTitle>
          <DialogDescription>
            Defina uma nova senha forte para garantir a segurança da sua conta na Central.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-pass">Nova senha</Label>
            <div className="relative">
              <Input
                id="new-pass"
                type={showPass ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPass(!showPass)}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pass">Confirmar nova senha</Label>
            <Input
              id="confirm-pass"
              type={showPass ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-[11px] text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground mb-1">Critérios mínimos:</p>
            <p
              className={cn("flex items-center gap-1.5", newPassword.length >= 8 && "text-success")}
            >
              <CheckCircle2 className="h-3 w-3" /> Pelo menos 8 caracteres
            </p>
            <p className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" /> Letras maiúsculas e minúsculas
            </p>
            <p className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" /> Pelo menos um número ou símbolo
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleUpdate} disabled={loading}>
            {loading ? (
              <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            Confirmar alteração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MfaModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Autenticação em duas etapas</DialogTitle>
          <DialogDescription>
            Siga os passos abaixo para ativar o MFA na sua conta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="flex items-center gap-4 p-4 rounded-lg bg-warning/10 border border-warning/30 text-warning">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="text-xs font-medium">
              O fluxo de login ainda não suporta redirecionamento MFA. A ativação pode impedir seu
              próximo acesso.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                1
              </span>
              <div>
                <p className="text-sm font-medium">Instale um app autenticador</p>
                <p className="text-xs text-muted-foreground">
                  Use Google Authenticator, Authy ou Microsoft Authenticator.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                2
              </span>
              <div className="space-y-3">
                <p className="text-sm font-medium">Escaneie o QR Code abaixo</p>
                <div className="flex justify-center p-4 border border-border rounded-lg bg-white">
                  <QrCode className="h-32 w-32 text-slate-800 opacity-20" />
                  {/* Real QR code logic would go here */}
                </div>
                <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest">
                  Aguardando geração do desafio...
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                3
              </span>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium">Insira o código de verificação</p>
                <Input
                  placeholder="000 000"
                  disabled
                  className="text-center text-lg tracking-[0.5em]"
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled>Verificar e Ativar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SessionsModal({
  open,
  onOpenChange,
  onSignOutOthers,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSignOutOthers: () => void;
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar sessões ativas</DialogTitle>
          <DialogDescription>
            Visualize e controle onde sua conta da Central está sendo utilizada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="divide-y divide-border rounded-lg border border-border">
            <div className="flex items-center gap-3 p-4 bg-primary/5">
              <Monitor className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Sessão Atual (Este navegador)</p>
                  <StatusBadge tone="success">Conectado</StatusBadge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Este navegador • sessão autenticada pelo Supabase
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center p-4">
            <Button
              variant="outline"
              className="text-critical hover:bg-critical/10 hover:text-critical"
              onClick={() => {
                onOpenChange(false);
                onSignOutOthers();
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Encerrar todas as outras sessões
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
