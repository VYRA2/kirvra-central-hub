import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { getSession, hydrateSession } from "@/services/auth-service";

/**
 * Layout protegido da Central.
 * ssr: false porque a sessão vive no navegador; nenhum conteúdo protegido é
 * renderizado antes da validação.
 */
export const Route = createFileRoute("/_central")({
  ssr: false,
  beforeLoad: () => {
    hydrateSession();
    if (!getSession()) {
      throw redirect({ to: "/login", search: {} as any });
    }
  },
  component: () => <Outlet />,
});
