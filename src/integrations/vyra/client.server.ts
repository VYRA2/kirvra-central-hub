/**
 * Cliente Supabase VYRA2 para execução no servidor (server functions/rotas).
 *
 * Usa somente a publishable key: leitura pública ou validação de sessão.
 * Nenhuma service_role é lida aqui — a Central não possui essa chave e ela
 * jamais deve chegar ao repositório nem ao navegador.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createVyraFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request
        ? input.headers
        : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, name) =>
        headers.set(name, value),
      );
    }
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export interface VyraServerConfig {
  url: string;
  publishableKey: string;
}

/** Lê a configuração do servidor. Deve ser chamado dentro de um handler. */
export function readVyraServerConfig(): VyraServerConfig | null {
  const url = process.env["VYRA_SUPABASE_URL"];
  const publishableKey = process.env["VYRA_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

/**
 * Cria um cliente sem sessão persistida para uso dentro de handlers.
 * Retorna `null` quando as variáveis de ambiente ainda não foram definidas.
 */
export function createVyraServerClient(
  accessToken?: string,
): SupabaseClient | null {
  const config = readVyraServerConfig();
  if (!config) return null;

  return createClient(config.url, config.publishableKey, {
    global: {
      fetch: createVyraFetch(config.publishableKey),
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
