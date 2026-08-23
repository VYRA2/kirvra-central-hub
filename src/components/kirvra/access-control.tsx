/**
 * Camada centralizada de controle de acesso da Central.
 *
 * `ProtectedRoute` garante sessão válida; `RequirePermission` garante
 * permissão do cargo. Esconder item de menu não é segurança: nenhum dado é
 * buscado quando a permissão falta, e o RLS do VYRA2 é a barreira final.
 */
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { PermissionCode } from "@/integrations/vyra/access";
import { ACCESS_DENIAL_MESSAGE } from "@/integrations/vyra/access";

export function AccessLoading({ label = "Validando acesso…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-6 text-sm text-muted-foreground"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function AccessDenied({ message }: { message?: string }) {
  return (
    <section
      role="alert"
      className="rounded-lg border border-critical/40 bg-critical/10 p-6"
    >
      <div className="flex items-start gap-3">
        <ShieldOff className="mt-0.5 h-5 w-5 text-critical" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            Acesso negado
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {message ?? ACCESS_DENIAL_MESSAGE.no_permission}
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link to="/central">Voltar à Central de Comando</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Bloqueia o conteúdo enquanto a sessão não estiver resolvida e válida. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading && !session) return <AccessLoading label="Restaurando sessão…" />;
  if (!session) {
    return <AccessDenied message="Sessão ausente ou expirada. Entre novamente." />;
  }
  return <>{children}</>;
}

/**
 * Bloqueia o conteúdo quando o cargo não possui TODAS as permissões exigidas.
 * Vale também para acesso direto por URL: a rota renderiza a negação.
 */
export function RequirePermission({
  permissions,
  children,
}: {
  permissions: PermissionCode[];
  children: ReactNode;
}) {
  const { session, loading, canAll } = useAuth();
  if (loading && !session) return <AccessLoading />;
  if (!session) {
    return <AccessDenied message="Sessão ausente ou expirada. Entre novamente." />;
  }
  if (!canAll(permissions)) {
    return (
      <AccessDenied
        message={`${ACCESS_DENIAL_MESSAGE.no_permission} Permissões exigidas: ${permissions.join(", ")}.`}
      />
    );
  }
  return <>{children}</>;
}

/** Faixa permanente e não ocultável do modo demonstração. */
export function DemoModeBanner() {
  return (
    <div
      role="status"
      className="rounded-md border border-warning/50 bg-warning/15 px-3 py-2 text-[11px] font-semibold tracking-wide text-warning uppercase"
    >
      Modo demonstração — dados simulados. Nenhum registro real é criado.
    </div>
  );
}
