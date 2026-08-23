import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { ROUTE_PERMISSIONS } from "@/integrations/vyra/access";
import { safeInternalPath } from "@/lib/safe-redirect";
import { resolveCentralSession } from "@/services/auth-service";

/**
 * Layout protegido da Central.
 *
 * ssr: false porque a sessão do Supabase vive no navegador. Nenhum conteúdo
 * protegido é renderizado antes da validação: sessão ausente → /login,
 * primeiro acesso pendente → /primeiro-acesso, cargo sem permissão → tela de
 * acesso negado renderizada pela própria rota (não há vazamento de dados).
 */
export const Route = createFileRoute("/_central")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const session = await resolveCentralSession();
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: safeInternalPath(location.href) },
      });
    }
    if (session.firstAccessPending) {
      throw redirect({ to: "/primeiro-acesso" });
    }
    return { session, routePermissions: ROUTE_PERMISSIONS };
  },
  component: () => <Outlet />,
});
