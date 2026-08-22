import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_central/saude-do-sistema")({
  component: () => <div>Página de Saúde do Sistema (Lote 2)</div>,
});
