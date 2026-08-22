import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KirvraAuthLayout } from "@/components/kirvra/auth-layout";
import { PendingIntegrationNotice } from "@/components/kirvra/primitives";
import {
  completeFirstAccess,
  isBackendAvailable,
  validatePasswordPolicy,
} from "@/services/auth-service";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/primeiro-acesso")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search["id"] === "string" ? (search["id"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "Primeiro acesso | Kirvra Central de Vigilância" },
      {
        name: "description",
        content:
          "Configuração do primeiro acesso de funcionários da Central KIRVRA, com substituição obrigatória da senha provisória.",
      },
      { property: "og:title", content: "Primeiro acesso · Central KIRVRA" },
      {
        property: "og:description",
        content:
          "Substitua a senha provisória e ative seu acesso operacional à Central KIRVRA.",
      },
    ],
  }),
  component: FirstAccessPage,
});

const RULES = [
  "Mínimo de 12 caracteres",
  "Pelo menos uma letra",
  "Pelo menos um número",
  "Pelo menos um caractere especial",
];

function FirstAccessPage() {
  const navigate = useNavigate();
  const { id } = Route.useSearch();

  const [employeeCode, setEmployeeCode] = useState(id);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problems = validatePasswordPolicy(newPassword);
  const matches = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await completeFirstAccess({
      employeeCode,
      temporaryPassword,
      newPassword,
      confirmPassword,
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
    toast.success("Senha definida. Sessão atualizada.");
    void navigate({ to: "/central", replace: true });
  };

  return (
    <KirvraAuthLayout>
      <div className="rounded-xl border border-border bg-card p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]">
        <h2 className="text-lg font-semibold text-foreground">
          Configure seu acesso.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sua senha provisória foi emitida pela Central e precisa ser
          substituída antes do primeiro turno. Ela é invalidada assim que a nova
          senha for definida.
        </p>

        {!isBackendAvailable() ? (
          <div className="mt-4">
            <PendingIntegrationNotice message="Integração pendente: a troca de senha só será efetivada com o Supabase VYRA2 configurado. Nada é gravado neste momento." />
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="employee-code">ID de funcionário</Label>
            <Input
              id="employee-code"
              value={employeeCode}
              onChange={(event) => setEmployeeCode(event.target.value)}
              placeholder="KRV-0000"
              autoComplete="username"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="temp-password">Senha provisória</Label>
            <Input
              id="temp-password"
              type="password"
              autoComplete="current-password"
              value={temporaryPassword}
              onChange={(event) => setTemporaryPassword(event.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              aria-describedby="password-rules"
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
              required
            />
          </div>

          <ul
            id="password-rules"
            className="space-y-1 rounded-md border border-border bg-surface px-3 py-2.5 text-xs"
          >
            {RULES.map((rule) => {
              const ok = newPassword.length > 0 && !problems.includes(rule);
              return (
                <li
                  key={rule}
                  className={cn(
                    "flex items-center gap-2",
                    ok ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {ok ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {rule}
                </li>
              );
            })}
            <li
              className={cn(
                "flex items-center gap-2",
                matches ? "text-success" : "text-muted-foreground",
              )}
            >
              {matches ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Confirmação idêntica
            </li>
          </ul>

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
            ) : null}
            Definir nova senha
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() =>
              void navigate({ to: "/login", search: { redirect: "" } })
            }
          >
            Voltar ao login
          </Button>
        </form>
      </div>
    </KirvraAuthLayout>
  );
}
