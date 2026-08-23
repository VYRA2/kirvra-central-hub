/**
 * Controle central do modo demonstração.
 *
 * Habilitado EXCLUSIVAMENTE por VITE_KIRVRA_DEMO_MODE === "true".
 * Nunca por hostname, por ambiente de desenvolvimento, por falha de login ou
 * pela ausência das credenciais do VYRA2. Sem essa variável a aplicação opera
 * apenas com dados reais.
 */
export function isDemoModeEnabled(): boolean {
  return import.meta.env["VITE_KIRVRA_DEMO_MODE"] === "true";
}
