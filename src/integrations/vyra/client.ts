/**
 * Cliente Supabase do navegador — projeto VYRA2 (ref hwpansazevjwzdcmhssc).
 *
 * Este é o ÚNICO cliente que o código da aplicação deve usar no browser.
 * Os arquivos em src/integrations/supabase/* são gerados pelo Lovable Cloud
 * e permanecem no repositório apenas por não poderem ser removidos.
 *
 * Somente publishable/anon key. Nunca service_role no navegador.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const VYRA_STORAGE_KEY = "kirvra-central-auth";

function readBrowserConfig() {
  const url = import.meta.env["VITE_VYRA_SUPABASE_URL"] as string | undefined;
  const key = import.meta.env["VITE_VYRA_SUPABASE_PUBLISHABLE_KEY"] as
    | string
    | undefined;
  return { url, key };
}

/** Indica se a camada VYRA já tem credenciais configuradas. */
export function isVyraConfigured(): boolean {
  const { url, key } = readBrowserConfig();
  return Boolean(url && key);
}

/** URL do projeto VYRA2 quando configurada (sem expor a chave). */
export function getVyraUrl(): string | null {
  return readBrowserConfig().url ?? null;
}

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
    // Chaves sb_* são opacas, não são JWT: só o header apikey deve ir.
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

let cached: SupabaseClient | null = null;

/**
 * Retorna o cliente VYRA2 ou `null` quando as variáveis ainda não existem.
 * A aplicação trata `null` como "Integração pendente" — nunca simula sucesso.
 */
export function getVyraClient(): SupabaseClient | null {
  if (cached) return cached;
  const { url, key } = readBrowserConfig();
  if (!url || !key) return null;

  cached = createClient(url, key, {
    global: { fetch: createVyraFetch(key) },
    auth: {
      storageKey: VYRA_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return cached;
}
