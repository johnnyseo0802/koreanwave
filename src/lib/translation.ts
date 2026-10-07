export type TranslationLanguage = "ko" | "en";
export type TranslationContentType = "post" | "comment";
export type TranslationRequest = { contentType: TranslationContentType; contentId: string; targetLanguage: TranslationLanguage };
export type TranslationResult =
  | { ok: true; text: string; sourceLanguage: TranslationLanguage; targetLanguage: TranslationLanguage }
  | { ok: false; message: string };
export const translationUnavailable = "Translation is temporarily unavailable. The original is still available.";
export const languageNames = { ko: "Korean", en: "English" } as const;

/** Deliberately conservative, not a general language classifier. Unknown is safe.
 * Dominant Hangul permits common English loanwords. Balanced mixtures abstain.
 * Latin-only text needs several common English words; names/URLs alone abstain. */
export function detectConversationLanguage(text: string): TranslationLanguage | null {
  const clean = text.replace(/https?:\/\/\S+/gi, "");
  const letters = clean.match(/\p{L}/gu) ?? [];
  const hangul = clean.match(/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/g) ?? [];
  const latin = clean.match(/[a-z]/gi) ?? [];
  if (hangul.length >= 4 && hangul.length / Math.max(letters.length, 1) >= 0.65) return "ko";
  if (hangul.length || latin.length < 10 || latin.length / Math.max(letters.length, 1) < 0.95) return null;
  const words = new Set(clean.toLowerCase().match(/[a-z]+/g) ?? []);
  const evidence = ["the", "is", "are", "was", "were", "this", "that", "with", "and", "but", "you", "your", "it", "my", "have", "for", "not", "to", "of", "in", "can", "would", "really", "don't", "think"];
  return evidence.filter(word => words.has(word)).length >= 3 ? "en" : null;
}

export function parseTranslationRequest(value: unknown): TranslationRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).sort().join(",") !== "contentId,contentType,targetLanguage") return null;
  if (input.contentType !== "post" && input.contentType !== "comment") return null;
  if (input.targetLanguage !== "ko" && input.targetLanguage !== "en") return null;
  if (typeof input.contentId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.contentId)) return null;
  return { contentType: input.contentType, contentId: input.contentId, targetLanguage: input.targetLanguage };
}
