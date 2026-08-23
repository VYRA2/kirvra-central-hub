import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, MonitorPlay, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KirvraAuthLayout } from "@/components/kirvra/auth-layout";
import { PendingIntegrationNotice } from "@/components/kirvra/primitives";
import { safeInternalPath } from "@/lib/safe-redirect";
import {
  isBackendAvailable,
  isDemoAvailable,
  remainingLockSeconds,
  requestPasswordReset,
  resolveCentralSession,
  signIn,
  startDemoSession,
} from "@/services/auth-service";

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeInternalPath(search["redirect"]),
  }),
  head: () => ({
    meta: [
      { title: "Acesso à Central | KIRVRA Central" },
      {
        name: "description",
        content:
          "Acesso interno restrito da KIRVRA Central. Somente credenciais corporativas: sem cadastro público e sem login social.",
      },
      { property: "og:title", content: "Acesso à KIRVRA Central" },
      {
        property: "og:description",
        content:
          "Ambiente operacional restrito de vigilância KIRVRA. Sessão protegida e auditada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect: redirectTo } = Route.useSearch();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [demoStarting, setDemoStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backendAvailable = isBackendAvailable();
  const demoAvailable = isDemoAvailable();

  const goToDestination = async () => {
    await router.invalidate();
    const dest = safeInternalPath(redirectTo);
    if (dest) {
      await navigate({ href: dest, replace: true });
      return;
    }
    await navigate({ to: "/central", replace: true });
  };

  useEffect(() => {
    let active = true;
    void resolveCentralSession().then((session) => {
      if (!active || !session) return;
      if (session.firstAccessPending) {
        void navigate({ to: "/primeiro-acesso", replace: true });
        return;
      }
      void goToDestination();
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDemo = async () => {
    setError(null);
    setDemoStarting(true);
    const demo = startDemoSession();
    if (!demo) {
      setDemoStarting(false);
      setError("Modo demonstração desabilitado neste ambiente.");
      return;
    }
    await goToDestination();
    setDemoStarting(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (remainingLockSeconds() > 0) {
      setError(
        `Muitas tentativas. Aguarde ${remainingLockSeconds()} s para tentar novamente.`,
      );
      return;
    }

    setSubmitting(true);
    const result = await signIn(identifier, password);
    setSubmitting(false);

    if (result.status === "error") {
      setError(result.message);
      return;
    }
    if (result.status === "first_access") {
      void navigate({ to: "/primeiro-acesso", replace: true });
      return;
    }
    void goToDestination();
  };

  const handleReset = async () => {
    const result = await requestPasswordReset(identifier);
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
          Use suas credenciais internas KIRVRA.
        </p>

        {!backendAvailable ? (
          <div className="mt-4">
            <PendingIntegrationNotice message="Integração pendente: defina VITE_VYRA_SUPABASE_URL e VITE_VYRA_SUPABASE_PUBLISHABLE_KEY para autenticar no Supabase VYRA2. Sem elas nenhum login real é possível." />
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="identifier">
              Identificação interna ou e-mail corporativo
            </Label>
            <Input
              id="identifier"
              name="identifier"
              autoComplete="username"
              inputMode="text"
              placeholder="KRV-0000 ou nome@kirvra.com"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              aria-invalid={Boolean(error)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="pr-10"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(error)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Manter esta sessão neste dispositivo (persistência segura do
            Supabase)
          </label>

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

        {demoAvailable ? (
          <div className="mt-4 rounded-md border border-dashed border-warning/50 bg-warning/10 px-3 py-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={demoStarting}
              onClick={() => void handleDemo()}
            >
              {demoStarting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <MonitorPlay className="h-4 w-4" aria-hidden="true" />
              )}
              Entrar no modo demonstração
            </Button>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Habilitado por VITE_KIRVRA_DEMO_MODE. Dados simulados, sem
              gravação e sem ações críticas.
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => void navigate({ to: "/primeiro-acesso" })}
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
          Sem cadastro público e sem login social. Sessão protegida e auditada.
        </p>
      </div>
    </KirvraAuthLayout>
  );
}
