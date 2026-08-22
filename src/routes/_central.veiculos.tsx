import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_central/veiculos")({
  component: () => <div>Página de Veículos (Lote 2)</div>,
});
