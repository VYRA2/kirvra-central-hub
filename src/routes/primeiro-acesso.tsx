import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KirvraAuthLayout } from "@/components/kirvra/auth-layout";
import { PendingIntegrationNotice } from "@/components/kirvra/primitives";
import { cn } from "@/lib/utils";
import {
  completeFirstAccess,
  isBackendAvailable,
  resolveCentralSession,
  validatePasswordPolicy,
  type CentralSession,
} from "@/services/auth-service";

export const Route = createFileRoute("/primeiro-acesso")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Primeiro acesso | KIRVRA Central" },
      {
        name: "description",
        content:
          "Ativação do primeiro acesso de funcionários da KIRVRA Central, com substituição obrigatória da senha provisória.",
      },
      { property: "og:title", content: "Primeiro acesso · KIRVRA Central" },
      {
        property: "og:description",
        content: "Substitua a senha provisória e ative seu acesso operacional à KIRVRA Central.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FirstAccessPage,
});

const RULES: Array<{ label: string; test: (value: string) => boolean }> = [
  { label: "Mínimo de 12 caracteres", test: (v) => v.length >= 12 },
  { label: "Pelo menos uma letra maiúscula", test: (v) => /[A-Z]/.test(v) },
  { label: "Pelo menos uma letra minúscula", test: (v) => /[a-z]/.test(v) },
  { label: "Pelo menos um número", test: (v) => /\d/.test(v) },
  {
    label: "Pelo menos um caractere especial",
    test: (v) => /[^A-Za-z0-9]/.test(v),
  },
];

function FirstAccessPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<CentralSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void resolveCentralSession().then((resolved) => {
      if (!active) return;
      setSession(resolved);
      setChecking(false);
      if (!resolved) {
        void navigate({ to: "/login", search: { redirect: "" }, replace: true });
        return;
      }
      if (!resolved.firstAccessPending) {
        void navigate({ to: "/central", replace: true });
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const problems = validatePasswordPolicy(newPassword);
  const matches = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = problems.length === 0 && matches && acceptedTerms && !submitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await completeFirstAccess({
      newPassword,
      confirmPassword,
      acceptedTerms,
    });
    setSubmitting(false);

    if (result.status === "error") {
      setError(result.message);
      return;
    }
    if (result.status === "pending") {
      toast.warning(result.message);
      return;
    }
    toast.success("Primeiro acesso concluído. Bem-vindo à Central.");
    void navigate({ to: "/central", replace: true });
  };

  return (
    <KirvraAuthLayout>
      <div className="rounded-xl border border-border bg-card p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]">
        <h2 className="text-lg font-semibold text-foreground">Primeiro acesso</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Substitua a senha provisória para ativar seu acesso operacional.
        </p>

        {!isBackendAvailable() ? (
          <div className="mt-4">
            <PendingIntegrationNotice message="Integração pendente: sem as credenciais do Supabase VYRA2 a senha não pode ser alterada." />
          </div>
        ) : null}

        {checking ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Validando sessão…
          </p>
        ) : session ? (
          <>
            <dl className="mt-4 rounded-md border border-border bg-surface px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Funcionário</dt>
                <dd className="font-medium text-foreground">{session.employee.employeeCode}</dd>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Nome</dt>
                <dd className="text-foreground">{session.employee.fullName}</dd>
              </div>
            </dl>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  aria-invalid={confirmPassword.length > 0 && !matches}
                  required
                />
              </div>

              <ul className="space-y-1 rounded-md border border-border bg-surface px-3 py-2">
                {RULES.map((rule) => {
                  const ok = rule.test(newPassword);
                  return (
                    <li
                      key={rule.label}
                      className={cn(
                        "flex items-center gap-2 text-[11px]",
                        ok ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {ok ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {rule.label}
                    </li>
                  );
                })}
                <li
                  className={cn(
                    "flex items-center gap-2 text-[11px]",
                    matches ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {matches ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  As duas senhas coincidem
                </li>
              </ul>

              <label className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-primary"
                />
                Declaro ciência dos termos internos de operação: todas as ações na Central são
                auditadas e o uso indevido de dados é proibido.
              </label>

              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-critical/35 bg-critical/10 px-3 py-2 text-xs text-critical"
                >
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                )}
                Ativar acesso
              </Button>
            </form>
          </>
        ) : null}
      </div>
    </KirvraAuthLayout>
  );
}
