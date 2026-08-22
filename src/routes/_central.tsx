import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { resolveCentralSession } from "@/services/auth-service";
import { safeInternalPath } from "@/lib/safe-redirect";

/**
 * Layout protegido da Central.
 * ssr: false porque a sessão vive no navegador; nenhum conteúdo protegido é
 * renderizado antes da validação assíncrona da sessão.
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
    return { session };
  },
  component: () => <Outlet />,
});
