import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerConfig } from "@/lib/supabase/config";
import type { TranslationLanguage, TranslationRequest } from "@/lib/translation";

export type CacheIdentity = TranslationRequest & { sourceLanguage: TranslationLanguage; sourceHash: string };
type Claim = { state: "claimed"; id: string; lease: string } | { state: "hit"; text: string } | { state: "busy" | "limited" };

/** Project-wide secret, application-scoped wrapper (NOT a scoped Supabase key).
 * Only fixed translation tables/RPCs. Never exported as a general client, never
 * used for authoritative content/Auth reads or mixed with the SSR cookie client. */
export function translationCache() {
  const secret = process.env.SUPABASE_TRANSLATION_SECRET_KEY;
  if (!secret?.startsWith("sb_secret_")) return null;
  // Resolve the server runtime URL through the existing server config; avoid
  // build-time NEXT_PUBLIC inlining in this server-only adapter.
  const { url } = getSupabaseServerConfig();
  const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) }) } });
  const params = (k: CacheIdentity) => ({ p_type: k.contentType, p_id: k.contentId, p_source: k.sourceLanguage, p_target: k.targetLanguage, p_hash: k.sourceHash });
  return {
    async read(k: CacheIdentity): Promise<string | null> {
      const r = await client.from("conversation_translations").select("translated_text")
        .eq("content_type", k.contentType).eq("content_id", k.contentId)
        .eq("source_language", k.sourceLanguage).eq("target_language", k.targetLanguage).eq("source_hash", k.sourceHash).maybeSingle();
      if (r.error) throw new Error("translation_cache_unavailable");
      return r.data?.translated_text ?? null;
    },
    async claim(k: CacheIdentity, actor: string, provider: string, model: string): Promise<Claim> {
      const r = await client.rpc("claim_conversation_translation", { ...params(k), p_actor: actor, p_provider: provider, p_model: model });
      if (r.error || !r.data) throw new Error("translation_cache_unavailable");
      return r.data as Claim;
    },
    async finish(id: string, lease: string, text: string | null): Promise<boolean> {
      const r = await client.rpc("finish_conversation_translation", { p_id: id, p_lease: lease, p_text: text });
      return !r.error && r.data === true;
    },
  };
}
