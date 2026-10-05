"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createDiscussion, hideConversationPost, linkArticleDiscussion, moderateComment } from "@/app/admin/conversations/actions";
import { resolveCommunityReport } from "@/app/admin/community/actions";
import type { ConversationResult } from "@/lib/conversation";
const input = "mt-2 block w-full min-w-0 rounded-xl border bg-white p-3";
const button = "rounded-full border px-5 py-3 disabled:opacity-50";
function useAdminRequest() {
  const [busy, setBusy] = useState(false);const [message, setMessage] = useState("");const lock = useRef(false);const router = useRouter();
  return { busy, message, run: async (action: () => Promise<ConversationResult>, done?: () => void) => {
    if (lock.current) return;lock.current = true;setBusy(true);
    try { const r = await action();setMessage(r.message);if (r.ok) { done?.();router.refresh(); } } catch { setMessage("Could not confirm the change. Refresh before retrying."); } finally { lock.current = false;setBusy(false); }
  } };
}
export function ConversationModeration({ id, status, kind }: { id: string; status: string; kind: "comment" | "post" | "report" }) {
  const r = useAdminRequest();
  return <div className="mt-4"><div className="flex flex-wrap gap-3">{kind === "report" ? <button disabled={r.busy} className={button} onClick={() => void r.run(() => resolveCommunityReport(id))}>Mark reviewed</button> : <>{kind === "comment" && status === "pending" && <button disabled={r.busy} className={button} onClick={() => void r.run(() => moderateComment(id, status, "approved"))}>Approve comment</button>}{["pending", "approved"].includes(status) && <button disabled={r.busy} className={button} onClick={() => void r.run(() => kind === "post" ? hideConversationPost(id) : moderateComment(id, status, "rejected"))}>{status === "approved" ? "Hide" : "Reject"}</button>}</>}</div><p role="status" className="mt-3 text-sm">{r.message}</p></div>;
}
export function DiscussionEditor() {
  const r = useAdminRequest();const [done, setDone] = useState(false);
  if (done) return <p role="status">{r.message} Open Community moderation to approve it.</p>;
  return <form className="max-w-2xl space-y-4 rounded-xl border bg-white p-5" onSubmit={e => { e.preventDefault();const f = new FormData(e.currentTarget);void r.run(() => createDiscussion(f), () => setDone(true)); }}><h2 className="text-2xl font-semibold">Start a real discussion</h2><p>Operator-authored prompt, not a fabricated member experience. Strong opinions are welcome; attacks on people are not.</p><label className="block">Title<input name="title" required maxLength={160} disabled={r.busy} className={input} /></label><label className="block">Conversation starter<textarea name="body" required maxLength={2000} rows={4} disabled={r.busy} className={input} /></label><button disabled={r.busy} className={button}>Submit prompt for review</button><p role="status">{r.message}</p></form>;
}
export function ArticleDiscussionEditor({ articles, posts, links }: { articles: { id: string; title: string }[]; posts: { id: string; title: string | null }[]; links: { article_id: string; post_id: string }[] }) {
  const r = useAdminRequest();const [selected, setSelected] = useState("");
  const current = links.find(l => l.article_id === selected);
  return <form className="mt-8 max-w-2xl space-y-4 rounded-xl border bg-white p-5" onSubmit={e => { e.preventDefault();const f = new FormData(e.currentTarget);f.set("previous_post_id", current?.post_id ?? "");void r.run(() => linkArticleDiscussion(f)); }}><h2 className="text-2xl font-semibold">Article → conversation</h2><p>Select an existing approved Discussion. This never creates comments or publishes an article.</p><label className="block">Article<select name="article_id" value={selected} onChange={e => setSelected(e.target.value)} required disabled={r.busy} className={input}><option value="">Choose article</option>{articles.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label><p className="text-sm">Current connection: {current ? posts.find(p => p.id === current.post_id)?.title ?? "Unavailable discussion — choose a replacement" : "None"}</p><label className="block">Discussion<select name="post_id" required disabled={r.busy} className={input}><option value="">Choose discussion</option>{posts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label><button disabled={r.busy} className={button}>Save connection</button><p role="status">{r.message}</p></form>;
}
