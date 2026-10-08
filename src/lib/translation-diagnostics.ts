import "server-only";

// Closed vocabulary only: never serialize errors, messages, bodies, headers,
// model/env values, request IDs, user/content/cache IDs or source hashes.
const stages = ["configuration", "authentication", "source_read", "source_validation", "cache_read", "cache_claim", "provider_request", "provider_response", "provider_validation", "cache_finalize", "cache_release", "action"] as const;
const reasons = ["supabase_client_invalid", "cache_secret_missing", "cache_secret_invalid", "openai_key_missing", "model_missing", "model_format_invalid", "unavailable", "source_changed", "source_unavailable", "supabase_error", "invalid_rpc_response", "zero_rows_or_expired_lease", "application_limit", "lease_busy", "model_or_access", "authentication", "billing", "rate_limit", "permission", "provider_error", "request_rejected", "timeout", "network", "invalid_json", "incomplete", "refusal", "invalid_output", "empty_or_oversized", "unexpected"] as const;
const codes = ["model_not_found", "invalid_api_key", "insufficient_quota", "billing_hard_limit_reached", "rate_limit_exceeded", "permission_denied", "unsupported_model", "unsupported_parameter", "invalid_value", "max_output_tokens", "content_filter", "42501", "42P01", "42883", "23503", "23505", "23514", "PGRST202", "PGRST205", "PGRST301", "PGRST303"] as const;
type Stage = typeof stages[number];
type Reason = typeof reasons[number];
export function translationDiagnostic(stage: Stage, reason: Reason, status?: unknown, code?: unknown) {
  const event = {
    event: "translation.failure", version: 1,
    stage: stages.includes(stage) ? stage : "action",
    reason: reasons.includes(reason) ? reason : "unexpected",
    ...(typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}),
    ...(typeof code === "string" && (codes as readonly string[]).includes(code) ? { code } : {}),
  };
  try { console.warn(JSON.stringify(event)); } catch { /* Logging must not alter fallback behavior. */ }
}
export class TranslationFailure extends Error {
  constructor(readonly stage: Stage, readonly reason: Reason, readonly status?: unknown, readonly code?: unknown) {
    super("translation_unavailable");
  }
}
export function reportTranslationFailure(error: unknown, stage: Stage) {
  if (error instanceof TranslationFailure) translationDiagnostic(error.stage, error.reason, error.status, error.code);
  else {
    const name = error && typeof error === "object" && "name" in error ? error.name : null;
    translationDiagnostic(stage, name === "TimeoutError" || name === "AbortError" ? "timeout" : name === "TypeError" ? "network" : "unexpected");
  }
}
