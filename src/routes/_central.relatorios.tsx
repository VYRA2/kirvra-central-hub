import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_central/relatorios")({
  component: () => <div>Página de Relatórios (Lote 2)</div>,
});
