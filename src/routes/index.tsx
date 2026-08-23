import { createFileRoute, redirect } from "@tanstack/react-router";

import { resolveCentralSession } from "@/services/auth-service";

/**
 * Porta de entrada da Central: nunca renderiza conteúdo.
 * Sessão válida → /central; primeiro acesso pendente → /primeiro-acesso;
 * sem sessão → /login.
 */
export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "KIRVRA Central — Vigilância e Atendimento de Alertas" },
      {
        name: "description",
        content:
          "Central operacional KIRVRA: monitoramento ao vivo, análise humana e atendimento de alertas de segurança do KIRVRA Drive e AI Engine.",
      },
      { property: "og:title", content: "KIRVRA Central" },
      {
        property: "og:description",
        content:
          "Plataforma interna de monitoramento, análise humana e atendimento de alertas de segurança KIRVRA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: async () => {
    const session = await resolveCentralSession();
    if (session?.firstAccessPending) {
      throw redirect({ to: "/primeiro-acesso" });
    }
    if (session) throw redirect({ to: "/central" });
    throw redirect({ to: "/login", search: { redirect: "" } });
  },
});
