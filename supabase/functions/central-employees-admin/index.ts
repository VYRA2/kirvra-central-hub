import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const rolePrefixes: Record<string, string> = {
  super_admin: "SADM",
  admin: "ADM",
  gerente: "GER",
  supervisor: "SUP",
  operador: "OP",
  auditor: "AUD",
};

const safeText = (value: unknown, max = 200) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

async function generateEmployeeCode(admin: ReturnType<typeof createClient>, prefix: string) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const suffix = crypto.getRandomValues(new Uint32Array(1))[0] % 10_000;
    const code = `KRV-${prefix}-${suffix.toString().padStart(4, "0")}`;
    const { data } = await admin
      .from("central_profiles")
      .select("id")
      .eq("employee_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("Não foi possível gerar um ID interno único.");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return respond(405, { error: "Método não permitido." });

  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return respond(401, { error: "Sessão obrigatória." });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serverKey =
    Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serverKey)
    return respond(500, { error: "Configuração interna indisponível." });

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return respond(401, { error: "Sessão inválida ou expirada." });
  const actorId = userData.user.id;

  const { data: allowed } = await userClient.rpc("central_has_permission", {
    _permission: "employees.manage",
  });
  if (!allowed)
    return respond(403, { error: "Você não possui permissão para criar funcionários." });

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return respond(400, { error: "Corpo JSON inválido." });
  }

  if (body.action !== "employee.create")
    return respond(400, { error: "Ação administrativa inválida." });
  const payload = (body.payload ?? {}) as Record<string, unknown>;
  const fullName = safeText(payload.full_name, 120);
  const phone = safeText(payload.phone, 30) || null;
  const roleId = safeText(payload.role_id, 36);
  const password = safeText(payload.temp_password, 200);
  const active = payload.is_active !== false;
  const firstAccess = payload.require_new_password !== false;

  if (fullName.length < 2 || !roleId || password.length < 12) {
    return respond(400, {
      error: "Nome, cargo e senha provisória de pelo menos 12 caracteres são obrigatórios.",
    });
  }

  const [{ data: targetRole }, { data: actorRoles }] = await Promise.all([
    admin
      .from("central_roles")
      .select("id,code,name,hierarchy_level")
      .eq("id", roleId)
      .maybeSingle(),
    admin
      .from("central_user_roles")
      .select("central_roles(hierarchy_level)")
      .eq("user_id", actorId),
  ]);
  if (!targetRole) return respond(400, { error: "Cargo inválido." });
  const actorLevel = Math.max(
    ...(actorRoles ?? []).map((item) =>
      Number((item.central_roles as { hierarchy_level?: number } | null)?.hierarchy_level ?? 0),
    ),
    0,
  );
  if (actorLevel <= Number(targetRole.hierarchy_level)) {
    return respond(403, { error: "Você só pode criar contas com nível inferior ao seu." });
  }

  const employeeCode = await generateEmployeeCode(admin, rolePrefixes[targetRole.code] ?? "USR");
  const internalEmail = `${employeeCode.toLowerCase()}@central.kirvra.internal`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, employee_code: employeeCode },
  });
  if (createError || !created.user)
    return respond(400, { error: createError?.message ?? "Não foi possível criar o acesso." });

  const newUserId = created.user.id;
  try {
    const { error: profileError } = await admin.from("central_profiles").insert({
      id: newUserId,
      employee_code: employeeCode,
      full_name: fullName,
      phone,
      status: active ? "ativo" : "suspenso",
      primeiro_acesso: firstAccess,
      created_by: actorId,
    });
    if (profileError) throw profileError;

    const { error: roleError } = await admin.from("central_user_roles").insert({
      user_id: newUserId,
      role_id: roleId,
      assigned_by: actorId,
    });
    if (roleError) throw roleError;

    const { error: auditError } = await admin.from("central_audit_logs").insert({
      operator_id: actorId,
      action: "employee.create",
      entity_type: "central_profiles",
      entity_id: newUserId,
      previous_data: null,
      next_data: {
        employee_code: employeeCode,
        full_name: fullName,
        role_id: roleId,
        status: active ? "ativo" : "suspenso",
      },
      user_agent: request.headers.get("user-agent")?.slice(0, 1000) ?? null,
    });
    if (auditError) throw auditError;
  } catch (error) {
    await admin.from("central_user_roles").delete().eq("user_id", newUserId);
    await admin.from("central_profiles").delete().eq("id", newUserId);
    await admin.auth.admin.deleteUser(newUserId);
    console.error("employee.create rollback", error);
    return respond(500, { error: "A criação foi cancelada sem deixar cadastro parcial." });
  }

  return respond(201, { success: true, employee_code: employeeCode, login: employeeCode });
});
