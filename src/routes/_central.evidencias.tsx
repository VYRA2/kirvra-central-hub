import { createFileRoute } from "@tanstack/react-router";

import { useQuery } from "@tanstack/react-query";
import { KirvraAppShell } from "@/components/kirvra/app-shell";
import { RequirePermission } from "@/components/kirvra/access-control";
import { listEvidence } from "@/services/evidence-service";

export const Route = createFileRoute("/_central/evidencias")({
  component: () => (
    <RequirePermission permissions={["evidence.view"]}>
      <EvidenciasPage />
    </RequirePermission>
  ),
});

function EvidenciasPage() {
  return (
    <KirvraAppShell title="Evidências">
      <div>Conteúdo da tela de evidências</div>
    </KirvraAppShell>
  );
}
