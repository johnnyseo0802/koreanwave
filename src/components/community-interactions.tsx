"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { setHelpful, reportPost } from "@/app/community/actions";
import { reportReasons } from "@/lib/community";
export function CommunityInteractions({ id, initialHelpful, total }: { id: string; initialHelpful: boolean; total: number }) {
  const [helpful, setState] = useState(initialHelpful);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reported, setReported] = useState(false);
  const lock = useRef(false); const router = useRouter();
  async function run(action: () => Promise<{ ok: boolean; message: string }>, success: () => void) {
    if (lock.current) return; lock.current = true; setBusy(true);
    try { const result = await action(); setMessage(result.message); if (result.ok) { success(); router.refresh(); } }
    catch { setMessage("We couldn’t confirm this action. Please refresh before trying again."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="mt-8 space-y-5">
    <button disabled={busy} aria-pressed={helpful} className="rounded-full border border-[#557b39] px-5 py-3 font-semibold disabled:opacity-50" onClick={() => run(() => setHelpful(id,!helpful), () => setState(!helpful))}>{helpful ? "✓ Helpful" : "Helpful"} · {total}</button>
    <details className="rounded-xl border p-5"><summary className="cursor-pointer py-2 font-semibold">Report this post</summary>{reported ? <p className="mt-4">Report received. Thank you for helping keep the community safe.</p> : <form className="mt-5 space-y-4" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void run(() => reportPost(id,form), () => setReported(true)); }}><label className="block">Reason<select name="reason" disabled={busy} className="mt-2 block w-full rounded-xl border bg-white p-3">{reportReasons.map(r => <option key={r} value={r}>{r.replaceAll("_"," ")}</option>)}</select></label><label className="block">Details (optional)<textarea name="details" maxLength={1000} rows={4} disabled={busy} className="mt-2 block w-full rounded-xl border p-3" /></label><p className="text-sm">Reports are private to the moderation team. Do not include personal contact information.</p><button disabled={busy} className="rounded-full bg-[#17201d] px-5 py-3 text-white disabled:opacity-50">Submit report</button></form>}</details><p role="status" aria-live="polite">{message}</p>
  </section>;
}
