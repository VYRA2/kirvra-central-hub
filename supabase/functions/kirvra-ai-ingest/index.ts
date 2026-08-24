import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-kirvra-ai-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const riskLevels = new Set(["normal", "attention", "suspected", "critical"]);
const evidenceTypes = new Set(["image", "audio", "video", "document"]);
const extensions = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "wav",
  "mp3",
  "m4a",
  "mp4",
  "webm",
  "pdf",
]);

const safeText = (value: unknown, max = 200) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function numeric(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return respond(405, { error: "Método não permitido." });

  const expectedKey = Deno.env.get("KIRVRA_AI_INGEST_KEY");
  const suppliedKey = request.headers.get("x-kirvra-ai-key");
  if (!expectedKey || !suppliedKey || suppliedKey !== expectedKey) {
    return respond(401, { error: "Credencial do motor de IA inválida." });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serverKey =
    Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serverKey) return respond(500, { error: "Configuração interna indisponível." });
  const admin = createClient(url, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 256_000) return respond(413, { error: "Payload excede o limite permitido." });
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return respond(400, { error: "Corpo JSON inválido." });
  }

  const action = safeText(body.action, 40);
  const payload = (body.payload ?? {}) as Record<string, unknown>;
  const sessionId = safeText(payload.session_id, 36);
  if (!sessionId) return respond(400, { error: "session_id é obrigatório." });

  const { data: session, error: sessionError } = await admin
    .from("protection_sessions")
    .select("id,driver_id,vehicle_id,status")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError || !session) return respond(404, { error: "Sessão não encontrada." });
  if (session.status !== "active") return respond(409, { error: "A sessão não está ativa." });

  if (action === "evidence.upload_url") {
    const evidenceType = safeText(payload.evidence_type, 20);
    const extension = safeText(payload.extension, 8).toLowerCase().replace(/^\./, "");
    if (!evidenceTypes.has(evidenceType) || !extensions.has(extension)) {
      return respond(400, { error: "Tipo ou extensão de evidência inválido." });
    }
    const storagePath = `${session.driver_id}/${session.id}/${crypto.randomUUID()}.${extension}`;
    const { data, error } = await admin.storage
      .from("alert-evidence")
      .createSignedUploadUrl(storagePath);
    if (error) return respond(500, { error: "Não foi possível preparar o envio da evidência." });
    return respond(200, {
      storage_bucket: "alert-evidence",
      storage_path: storagePath,
      signed_url: data.signedUrl,
      token: data.token,
    });
  }

  if (action !== "analysis.result") return respond(400, { error: "Ação de IA inválida." });

  const detected = payload.detected === true;
  const score = numeric(payload.risk_score, 0, 100, 0);
  const confidence = numeric(payload.confidence, 0, 1, 0);
  const riskLevel = riskLevels.has(payload.risk_level) ? payload.risk_level : "normal";
  const analyzedAt = new Date().toISOString();

  const { error: updateError } = await admin
    .from("protection_sessions")
    .update({
      current_risk_level: riskLevel,
      current_risk_score: score,
      last_ai_analysis_at: analyzedAt,
    })
    .eq("id", session.id)
    .eq("status", "active");
  if (updateError) return respond(500, { error: "Não foi possível atualizar a sessão." });
  if (!detected) return respond(200, { accepted: true, alert_created: false });

  const { data: alert, error: alertError } = await admin
    .from("security_alerts")
    .insert({
      session_id: session.id,
      driver_id: session.driver_id,
      vehicle_id: session.vehicle_id,
      source: safeText(payload.source, 50) || "kirvra_ai_engine",
      threat_type: safeText(payload.threat_type, 100) || "unknown",
      threat_class: safeText(payload.threat_class, 100) || null,
      confidence,
      risk_score: score,
      risk_level: riskLevel,
      latitude: payload.latitude == null ? null : numeric(payload.latitude, -90, 90, 0),
      longitude: payload.longitude == null ? null : numeric(payload.longitude, -180, 180, 0),
      detected_at: safeText(payload.detected_at, 40) || analyzedAt,
      status: "new",
      notes: safeText(payload.notes, 1000) || null,
    })
    .select("id")
    .single();
  if (alertError || !alert) return respond(500, { error: "Não foi possível registrar o alerta." });

  const evidenceInput = Array.isArray(payload.evidence) ? payload.evidence.slice(0, 12) : [];
  const evidenceRows = evidenceInput.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const value = item as Record<string, unknown>;
    const evidenceType = safeText(value.evidence_type, 20);
    const storagePath = safeText(value.storage_path, 500);
    if (
      !evidenceTypes.has(evidenceType) ||
      !storagePath.startsWith(`${session.driver_id}/${session.id}/`)
    )
      return [];
    return [
      {
        security_alert_id: alert.id,
        session_id: session.id,
        driver_id: session.driver_id,
        evidence_type: evidenceType,
        storage_bucket: "alert-evidence",
        storage_path: storagePath,
        mime_type: safeText(value.mime_type, 100) || null,
        size_bytes:
          value.size_bytes == null ? null : Math.max(0, Math.trunc(Number(value.size_bytes))),
        sha256: safeText(value.sha256, 128) || null,
        metadata:
          value.metadata && typeof value.metadata === "object" && !Array.isArray(value.metadata)
            ? value.metadata
            : {},
        captured_at: safeText(value.captured_at, 40) || analyzedAt,
      },
    ];
  });

  if (evidenceRows.length > 0) {
    const { error } = await admin.from("alert_evidence").insert(evidenceRows);
    if (error) console.error("Evidence insert failed", { alertId: alert.id, code: error.code });
  }

  return respond(201, {
    accepted: true,
    alert_created: true,
    alert_id: alert.id,
    evidence_count: evidenceRows.length,
  });
});
