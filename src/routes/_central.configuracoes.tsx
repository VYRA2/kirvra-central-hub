import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_central/configuracoes")({
  component: () => <div>Página de Configurações (Lote 2)</div>,
});
