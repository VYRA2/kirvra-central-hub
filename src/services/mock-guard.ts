/**
 * Guarda dos dados simulados.
 *
 * As telas ainda não migradas para o VYRA2 leem mocks locais. Fora do modo
 * demonstração (VITE_KIRVRA_DEMO_MODE=true) esses dados NUNCA podem aparecer
 * como reais: a leitura falha explicitamente e a tela mostra estado pendente.
 */
import { isDemoModeEnabled } from "./demo-mode";

export class MockDataDisabledError extends Error {
  constructor() {
    super(
      "Integração pendente: esta tela ainda não está ligada ao backend KIRVRA. Dados simulados só são exibidos com VITE_KIRVRA_DEMO_MODE=true.",
    );
    this.name = "MockDataDisabledError";
  }
}

/** Lança quando o modo demonstração está desativado. */
export function assertDemoData(): void {
  if (!isDemoModeEnabled()) throw new MockDataDisabledError();
}
