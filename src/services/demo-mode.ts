/**
 * Controle central do modo demonstração.
 *
 * O modo demonstração NUNCA pode ser habilitado por hostname, por falha de
 * login ou pela ausência do Supabase. Ele existe apenas em desenvolvimento
 * (import.meta.env.DEV) ou quando a variável pública VITE_KIRVRA_DEMO_MODE
 * for explicitamente "true" no build.
 */
export function isDemoModeEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  return import.meta.env["VITE_KIRVRA_DEMO_MODE"] === "true";
}
