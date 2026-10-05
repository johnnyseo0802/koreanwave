"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { reactToPost, reportComment, submitComment } from "@/app/community/conversation-actions";
import { commentError, reactionKinds, type ConversationResult } from "@/lib/conversation";
import { reportReasons } from "@/lib/community";
const input = "mt-2 block w-full min-w-0 rounded-xl border bg-white p-3";
const button = "rounded-full border border-[#557b39] px-5 py-3 font-semibold disabled:opacity-50";
function useRequest() {
  const lock = useRef(false);const [busy, setBusy] = useState(false);const [message, setMessage] = useState("");const router = useRouter();
  return { busy, message, run: async (action: () => Promise<ConversationResult>, done?: () => void) => {
    if (lock.current) return;lock.current = true;setBusy(true);
    try { const r = await action();setMessage(r.message);if (r.ok) { done?.();router.refresh(); } }
    catch { setMessage("Could not confirm the action. Refresh before trying again."); }
    finally { lock.current = false;setBusy(false); }
  } };
}
export function CommentComposer({ postId, parent = null }: { postId: string; parent?: string | null }) {
  const request = useRequest();const fieldId = useId();const [body, setBody] = useState("");const [done, setDone] = useState(false);const [error, setError] = useState("");
  if (done) return <p role="status" className="rounded-xl bg-[#edf3e5] p-4">{request.message}</p>;
  return <form className="my-4 min-w-0 space-y-3" onSubmit={e => { e.preventDefault();const error = commentError(body);setError(error ?? "");if (!error) { const form = new FormData(e.currentTarget);void request.run(() => submitComment(postId, parent, form), () => { setDone(true);setBody(""); }); } }}>
    <label htmlFor={fieldId} className="block font-semibold">{parent ? "Your reply" : "Add your take"}</label><textarea id={fieldId} name="body" value={body} onChange={e => setBody(e.target.value)} required rows={3} disabled={request.busy} className={input} />
    <p className="text-sm">{Array.from(body.trim()).length} / 2,000 · Posts immediately. Disagree with ideas, not people.</p>
    <button disabled={request.busy} className={button}>{request.busy ? "Posting…" : parent ? "Post reply" : "Post comment"}</button>
    <p role="status" className="text-sm">{error || request.message}</p>
  </form>;
}
export function ReactionButtons({ postId, mine, counts }: { postId: string; mine: string[]; counts: Record<string, number> }) {
  const request = useRequest();
  return <div className="my-5"><div className="flex flex-wrap gap-2">{reactionKinds.map(kind => <button key={kind} disabled={request.busy} aria-pressed={mine.includes(kind)} className={`${button} capitalize`} onClick={() => void request.run(() => reactToPost(postId, kind, !mine.includes(kind)))}>{kind} · {counts[kind] ?? 0}</button>)}</div><p role="status" className="mt-2 text-sm">{request.message}</p></div>;
}
export function CommentReport({ postId, id }: { postId: string; id: string }) {
  const request = useRequest();const fieldId = useId();const [done, setDone] = useState(false);
  return <details className="mt-3"><summary className="cursor-pointer py-3 text-sm underline">Report comment</summary>{done ? <p role="status">{request.message}</p> : <form className="space-y-3" onSubmit={e => { e.preventDefault();const f = new FormData(e.currentTarget);void request.run(() => reportComment(postId, id, f), () => setDone(true)); }}><label htmlFor={`${fieldId}-reason`} className="block">Reason</label><select id={`${fieldId}-reason`} name="reason" disabled={request.busy} className={input}>{reportReasons.map(r => <option key={r} value={r}>{r.replaceAll("_", " ")}</option>)}</select><label htmlFor={`${fieldId}-details`} className="block">Details (optional)</label><textarea id={`${fieldId}-details`} name="details" maxLength={1000} rows={2} disabled={request.busy} className={input} /><p className="text-sm">Only moderators see your report. Do not include contact details.</p><button disabled={request.busy} className={button}>Send report</button><p role="status">{request.message}</p></form>}</details>;
}
