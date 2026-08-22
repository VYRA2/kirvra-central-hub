import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KirvraAuthLayout } from "@/components/kirvra/auth-layout";
import { PendingIntegrationNotice } from "@/components/kirvra/primitives";
import {
  getSession,
  isBackendAvailable,
  remainingLockSeconds,
  requestPasswordReset,
  signIn,
} from "@/services/auth-service";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acesso à Central | Kirvra Central de Vigilância" },
      {
        name: "description",
        content:
          "Acesso interno restrito da Central KIRVRA. Somente credenciais corporativas, sem cadastro público ou login social.",
      },
      { property: "og:title", content: "Acesso à Central KIRVRA" },
      {
        property: "og:description",
        content:
          "Ambiente operacional restrito de vigilância KIRVRA. Sessão protegida e auditada.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backendAvailable = isBackendAvailable();

  useEffect(() => {
    if (getSession()) void navigate({ to: "/central", replace: true });
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!employeeCode.trim() || !password) {
      setError("Informe o ID de funcionário e a senha.");
      return;
    }
    if (remainingLockSeconds() > 0) {
      setError(
        `Muitas tentativas. Aguarde ${remainingLockSeconds()} s para tentar novamente.`,
      );
      return;
    }

    setSubmitting(true);
    const result = await signIn(employeeCode, password);
    setSubmitting(false);

    if (result.status === "error") {
      setError(result.message);
      return;
    }
    if (result.status === "first_access") {
      void navigate({
        to: "/primeiro-acesso",
        search: { id: result.employeeCode },
      });
      return;
    }
    void navigate({ to: "/central", replace: true });
  };

  const handleReset = async () => {
    const result = await requestPasswordReset(employeeCode);
    if (result.status === "error") toast.error(result.message);
    else if (result.status === "pending") toast.warning(result.message);
  };

  return (
    <KirvraAuthLayout>
      <div className="rounded-xl border border-border bg-card p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]">
        <h2 className="text-lg font-semibold text-foreground">
          Acesso à Central
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use suas credenciais internas Kirvra.
        </p>

        {!backendAvailable ? (
          <div className="mt-4">
            <PendingIntegrationNotice message="Integração pendente: as variáveis do Supabase VYRA2 ainda não foram definidas. O acesso abaixo abre uma sessão local de demonstração, sem backend e sem gravação." />
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="employee-code">ID de funcionário</Label>
            <Input
              id="employee-code"
              name="employee-code"
              autoComplete="username"
              inputMode="text"
              placeholder="KRV-0000"
              value={employeeCode}
              onChange={(event) => setEmployeeCode(event.target.value)}
              aria-invalid={Boolean(error)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(error)}
              required
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-critical/35 bg-critical/10 px-3 py-2 text-xs text-critical"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            )}
            Entrar com segurança
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => void navigate({ to: "/primeiro-acesso", search: {} as any } as any)}
          >
            Primeiro acesso
          </Button>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs text-muted-foreground"
            onClick={() => void handleReset()}
          >
            Solicitar redefinição
          </Button>
        </div>

        <p className="mt-5 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
          Sem cadastro público ou login social. Sessão protegida e auditada.
        </p>
      </div>
    </KirvraAuthLayout>
  );
}
