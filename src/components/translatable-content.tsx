"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { translateConversation } from "@/app/community/translation-actions";
import { detectConversationLanguage, languageNames, translationUnavailable, type TranslationContentType } from "@/lib/translation";

export function TranslatableContent({ contentType, contentId, originalText, authenticated, postId }: {
  contentType: TranslationContentType; contentId: string; originalText: string; authenticated: boolean; postId: string;
}) {
  // Remount only when the authoritative original/identity changes, never reuse a
  // stale client translation after a router refresh or source edit.
  return <TranslationView key={`${contentType}:${contentId}:${originalText}`} {...{ contentType, contentId, originalText, authenticated, postId }} />;
}
function TranslationView({ contentType, contentId, originalText, authenticated, postId }: Parameters<typeof TranslatableContent>[0]) {
  const source = detectConversationLanguage(originalText);
  const target = source === "ko" ? "en" : "ko";
  const [translated, setTranslated] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  async function translate() {
    if (lock.current) return;
    if (translated) { setShowTranslation(true); return; }
    lock.current = true; setBusy(true); setMessage("");
    try {
      const result = await translateConversation({ contentType, contentId, targetLanguage: target });
      if (result.ok) { setTranslated(result.text); setShowTranslation(true); }
      else setMessage(result.message);
    } catch { setMessage(translationUnavailable); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="mt-3 min-w-0" data-translation-content={contentId}>
    <p hidden={showTranslation} lang={source ?? undefined} className="whitespace-pre-wrap break-words leading-7 [overflow-wrap:anywhere]">{originalText}</p>
    {showTranslation && source && <div><p className="mb-2 text-xs text-[#69736c]">Translated from {languageNames[source]} · AI translation</p><p lang={target} className="whitespace-pre-wrap break-words leading-7 [overflow-wrap:anywhere]">{translated}</p></div>}
    {source ? authenticated ? <button type="button" disabled={busy} aria-busy={busy} onClick={showTranslation ? () => setShowTranslation(false) : translate} className="min-h-11 py-2 text-left text-sm font-semibold text-[#557b39] underline underline-offset-4 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2">{busy ? "Translating…" : showTranslation ? "Show original" : `Translate to ${languageNames[target]}`}</button> : <Link className="inline-flex min-h-11 items-center text-sm text-[#557b39] underline" href={`/login?next=${encodeURIComponent(`/community/posts/${postId}`)}`}>Log in to translate</Link> : <p className="mt-2 text-xs text-[#69736c]">Translation supports clearly detected Korean or English.</p>}
    <p role="status" aria-live="polite" className="text-sm text-[#69736c]">{busy ? "Translation in progress." : message}</p>
  </div>;
}
