"use server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { translationCache } from "@/lib/supabase/translation-cache";
import { translationSource } from "@/lib/translation-source";
import { translationProvider } from "@/lib/translation-provider";
import { measureTranslation, startTranslationTimer, reportTranslationFailure, translationDiagnostic } from "@/lib/translation-diagnostics";
import { detectConversationLanguage, parseTranslationRequest, translationUnavailable, type TranslationResult } from "@/lib/translation";

export async function translateConversation(input: unknown): Promise<TranslationResult> {
  const fail = (message = translationUnavailable): TranslationResult => ({ ok: false, message });
  const stopTotal = startTranslationTimer("total_request");
  let stage: Parameters<typeof reportTranslationFailure>[1] = "configuration";
  try {
    const request = parseTranslationRequest(input);
    if (!request) return fail("This translation request is not supported.");
    let client;
    try { client = await createClient(); }
    catch { translationDiagnostic("configuration", "supabase_client_invalid"); return fail(); }
    stage = "authentication";
    const auth = await measureTranslation("authentication", () => client.auth.getUser());
    if (auth.error || !auth.data.user) { translationDiagnostic("authentication", "unavailable"); return fail("Please log in to translate. The original is still available."); }
    stage = "source_read";
    const text = await measureTranslation("source_lookup", () => translationSource(client, request));
    if (!text || Array.from(text).length > 10000) { translationDiagnostic("source_validation", "source_unavailable"); return fail(); }
    const sourceLanguage = detectConversationLanguage(text);
    if (!sourceLanguage) return fail("We could not confidently detect Korean, English or Japanese. Please read the original.");
    if (sourceLanguage === request.targetLanguage) return fail("The original is already in the requested language.");
    const sourceHash = createHash("sha256").update(text, "utf8").digest("hex");
    const identity = { ...request, sourceLanguage, sourceHash };
    stage = "configuration";
    const cache = translationCache();
    if (!cache) return fail();
    // Revalidate source + parents on hits AND after provider latency. A cache row
    // never grants visibility. Unavoidable post-response moderation races are the
    // same as an original already delivered to a browser; no polling is added.
    const deliver = async (translated: string): Promise<TranslationResult> => {
      stage = "source_read";
      if (await measureTranslation("source_recheck_before_delivery", () => translationSource(client, request)) !== text) { translationDiagnostic("source_validation", "source_changed"); return fail(); }
      return { ok: true, text: translated, sourceLanguage, targetLanguage: request.targetLanguage };
    };
    stage = "cache_read";
    const hit = await measureTranslation("cache_read", () => cache.read(identity));
    if (hit) return await deliver(hit);
    stage = "configuration";
    const provider = translationProvider();
    if (!provider) return fail();
    stage = "cache_claim";
    const claim = await measureTranslation("cache_claim", () => cache.claim(identity, auth.data.user.id, provider.name, provider.model));
    if (claim.state === "hit") return await deliver(claim.text);
    if (claim.state === "limited") { translationDiagnostic("cache_claim", "application_limit"); return fail("Translation limit reached. Please try again later; the original is still available."); }
    if (claim.state !== "claimed") { translationDiagnostic("cache_claim", "lease_busy"); return fail("This translation is being prepared. Please try again shortly."); }
    try {
      stage = "provider_request";
      const translated = await provider.translateText({ text, sourceLanguage, targetLanguage: request.targetLanguage });
      stage = "source_read";
      if (await measureTranslation("source_recheck_before_finalize", () => translationSource(client, request)) !== text) { translationDiagnostic("source_validation", "source_changed"); stage = "cache_release"; await measureTranslation("cache_release", () => cache.finish(claim.id, claim.lease, null)); return fail(); }
      stage = "cache_finalize";
      if (!await measureTranslation("cache_finalize", () => cache.finish(claim.id, claim.lease, translated))) return fail();
      return await deliver(translated);
    } catch (error) {
      reportTranslationFailure(error, stage);
      stage = "cache_release";
      await measureTranslation("cache_release", () => cache.finish(claim.id, claim.lease, null));
      return fail();
    }
  } catch (error) { reportTranslationFailure(error, stage); return fail(); }
  finally { stopTotal(); }
}
