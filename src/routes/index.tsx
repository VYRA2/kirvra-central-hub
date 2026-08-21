import { createFileRoute, redirect } from "@tanstack/react-router";

import { getSession } from "@/services/auth-service";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Kirvra Central de Vigilância" },
      {
        name: "description",
        content:
          "Central operacional KIRVRA: monitoramento ao vivo, análise humana e atendimento de alertas de segurança.",
      },
      { property: "og:title", content: "Kirvra Central de Vigilância" },
      {
        property: "og:description",
        content:
          "Central operacional KIRVRA: monitoramento ao vivo, análise humana e atendimento de alertas de segurança.",
      },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: getSession() ? "/central" : "/login" });
  },
});
