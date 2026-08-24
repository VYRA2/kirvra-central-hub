import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveCentralSession } from "@/services/auth-service";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const session = await resolveCentralSession();
    if (session?.firstAccessPending) {
      throw redirect({ to: "/primeiro-acesso" });
    }
    if (session) throw redirect({ to: "/central" });
    throw redirect({ to: "/login", search: { redirect: "" } });
  },
});
