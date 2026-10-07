"use server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { translationCache } from "@/lib/supabase/translation-cache";
import { translationSource } from "@/lib/translation-source";
import { translationProvider } from "@/lib/translation-provider";
import { detectConversationLanguage, parseTranslationRequest, translationUnavailable, type TranslationResult } from "@/lib/translation";

export async function translateConversation(input: unknown): Promise<TranslationResult> {
  const fail = (message = translationUnavailable): TranslationResult => ({ ok: false, message });
  const request = parseTranslationRequest(input);
  if (!request) return fail("This translation request is not supported.");
  try {
    const client = await createClient();
    const auth = await client.auth.getUser();
    if (auth.error || !auth.data.user) return fail("Please log in to translate. The original is still available.");
    const text = await translationSource(client, request);
    if (!text || Array.from(text).length > 10000) return fail();
    const sourceLanguage = detectConversationLanguage(text);
    if (!sourceLanguage) return fail("We could not confidently detect Korean or English. Please read the original.");
    if (sourceLanguage === request.targetLanguage) return fail("The original is already in the requested language.");
    const sourceHash = createHash("sha256").update(text, "utf8").digest("hex");
    const identity = { ...request, sourceLanguage, sourceHash };
    const cache = translationCache();
    if (!cache) return fail();
    // Revalidate source + parents on hits AND after provider latency. A cache row
    // never grants visibility. Unavoidable post-response moderation races are the
    // same as an original already delivered to a browser; no polling is added.
    const deliver = async (translated: string): Promise<TranslationResult> => {
      if (await translationSource(client, request) !== text) return fail();
      return { ok: true, text: translated, sourceLanguage, targetLanguage: request.targetLanguage };
    };
    const hit = await cache.read(identity);
    if (hit) return deliver(hit);
    const provider = translationProvider();
    if (!provider) return fail();
    const claim = await cache.claim(identity, auth.data.user.id, provider.name, provider.model);
    if (claim.state === "hit") return deliver(claim.text);
    if (claim.state === "limited") return fail("Translation limit reached. Please try again later; the original is still available.");
    if (claim.state !== "claimed") return fail("This translation is being prepared. Please try again shortly.");
    try {
      const translated = await provider.translateText({ text, sourceLanguage, targetLanguage: request.targetLanguage });
      if (await translationSource(client, request) !== text) { await cache.finish(claim.id, claim.lease, null); return fail(); }
      if (!await cache.finish(claim.id, claim.lease, translated)) return fail();
      return deliver(translated);
    } catch {
      await cache.finish(claim.id, claim.lease, null);
      return fail();
    }
  } catch { return fail(); }
}
