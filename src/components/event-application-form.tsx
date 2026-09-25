"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import type { ApplicationResult } from "@/lib/events";

export function EventApplicationForm({ applyAction, loginHref }: { applyAction: () => Promise<ApplicationResult>; loginHref: string }) {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ApplicationResult | null>(null);
  async function apply() {
    if (lock.current || result?.ok || result?.alreadyApplied) return;
    lock.current = true; setPending(true); setResult(null);
    let done = false;
    try {
      const response = await applyAction();
      setResult(response); done = response.ok || !!response.alreadyApplied;
    } catch {
      setResult({ ok: false, message: "We couldn’t confirm your application. Check My Events before trying again." });
    } finally { setPending(false); if (!done) lock.current = false; }
  }
  return <div className="mt-5">
    {result && <p role={result.ok ? "status" : "alert"} className="mb-4 text-sm">{result.message} {result.ok && "We’ll show your application status in My Events."}</p>}
    {result?.ok || result?.alreadyApplied ? <Link href="/account/events" className="font-semibold underline">My Events</Link> : result?.loginRequired ? <Link href={loginHref} className="font-semibold underline">Log in to apply</Link> : <button type="button" onClick={apply} disabled={pending} className="rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Applying…" : "Apply to event"}</button>}
  </div>;
}
