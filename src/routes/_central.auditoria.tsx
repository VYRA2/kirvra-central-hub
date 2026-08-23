import { createFileRoute } from "@tanstack/react-router";

import { useQuery } from "@tanstack/react-query";
import { KirvraAppShell } from "@/components/kirvra/app-shell";
import { RequirePermission } from "@/components/kirvra/access-control";
import { listAuditLogs } from "@/services/audit-service";

export const Route = createFileRoute("/_central/auditoria")({
  component: () => (
    <RequirePermission permissions={["audit.view"]}>
      <AuditoriaPage />
    </RequirePermission>
  ),
});

function AuditoriaPage() {
  return (
    <KirvraAppShell title="Auditoria">
      <div>Conteúdo da tela de auditoria</div>
    </KirvraAppShell>
  );
}
