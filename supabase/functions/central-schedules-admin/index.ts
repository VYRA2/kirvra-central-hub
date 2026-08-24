import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedActions = new Set([
  "shift.create",
  "shift.update",
  "assignment.create",
  "assignment.update",
  "region.create",
  "region.update",
  "region_assignment.create",
  "region_assignment.update",
  "handover.request",
  "handover.resolve",
]);

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

const statusForDatabaseError = (code?: string) => {
  switch (code) {
    case "42501":
      return 403;
    case "23505":
      return 409;
    case "22023":
    case "22P02":
    case "23503":
    case "23514":
    case "P0002":
      return 400;
    default:
      return 500;
  }
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Metodo nao permitido." });
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return jsonResponse(401, { error: "Sessao obrigatoria." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serverKey =
    Deno.env.get("SUPABASE_SECRET_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serverKey) {
    console.error("Missing server-side Supabase configuration.");
    return jsonResponse(500, { error: "Configuracao interna indisponivel." });
  }

  const adminClient = createClient(supabaseUrl, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    return jsonResponse(401, { error: "Sessao invalida ou expirada." });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonResponse(400, { error: "Corpo JSON invalido." });
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return jsonResponse(400, { error: "Corpo da requisicao invalido." });
  }

  const body = input as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  const payload = body.payload ?? {};

  if (!allowedActions.has(action)) {
    return jsonResponse(400, { error: "Acao administrativa invalida." });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonResponse(400, { error: "O payload deve ser um objeto." });
  }

  if (JSON.stringify(payload).length > 64_000) {
    return jsonResponse(413, { error: "Payload excede o limite permitido." });
  }

  const { data, error } = await adminClient.rpc("central_schedule_admin", {
    _actor_id: user.id,
    _action: action,
    _payload: payload,
    _user_agent: request.headers.get("user-agent"),
  });

  if (error) {
    const status = statusForDatabaseError(error.code);
    console.error("central_schedule_admin failed", {
      code: error.code,
      action,
      userId: user.id,
    });

    return jsonResponse(status, {
      error:
        status === 500
          ? "Nao foi possivel concluir a operacao."
          : error.message,
      code: error.code,
    });
  }

  return jsonResponse(200, data);
});
