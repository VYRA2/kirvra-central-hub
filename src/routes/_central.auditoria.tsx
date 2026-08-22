import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_central/auditoria")({
  component: () => <div>Página de Auditoria (Lote 2)</div>,
});
