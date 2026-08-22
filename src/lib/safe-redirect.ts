/**
 * Aceita apenas caminhos internos ("/algo"). Qualquer URL externa,
 * protocolo relativo ("//host") ou valor inválido vira "".
 */
export function safeInternalPath(value: unknown): string {
  if (typeof value !== "string") return "";
  if (!value.startsWith("/")) return "";
  if (value.startsWith("//")) return "";
  if (value.includes("\\")) return "";
  if (value === "/login") return "";
  return value;
}
