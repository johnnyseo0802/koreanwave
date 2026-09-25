"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moderateAnswer } from "@/app/admin/answers/actions";

export type PendingAnswer = { id: string; question_title: string; body: string; created_at: string; status: string };

export function AnswerModerationQueue({ answers }: { answers: PendingAnswer[] }) {
  const router = useRouter();
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [completed, setCompleted] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const busy = pending || refreshing;
  const visible = answers.filter((answer) => !completed.includes(answer.id));

  async function decide(id: string, decision: "approved" | "rejected") {
    if (lock.current || busy || completed.includes(id)) return;
    lock.current = true;
    setPending(true);
    setFeedback(null);
    try {
      const result = await moderateAnswer(id, decision);
      setFeedback(result);
      if (result.ok) {
        setCompleted((previous) => [...previous, id]);
        startTransition(() => router.refresh());
      }
    } catch {
      setFeedback({ ok: false, message: "We couldn’t confirm this decision. Refresh the queue before trying again." });
    } finally {
      setPending(false);
      lock.current = false;
    }
  }

  return <div className="mt-8" aria-busy={busy}>
    {feedback && <p role={feedback.ok ? "status" : "alert"} className={`mb-6 rounded-xl p-4 text-sm ${feedback.ok ? "bg-[#f4f7f0] text-[#3d5630]" : "bg-[#fdf0ed] text-[#a1432d]"}`}>{feedback.message}</p>}
    <button type="button" disabled={busy} onClick={() => startTransition(() => router.refresh())} className="mb-6 rounded-full border border-[#dce2dc] px-4 py-2 text-sm font-medium disabled:opacity-50">{refreshing ? "Refreshing…" : "Refresh queue"}</button>
    {!visible.length && <p className="rounded-2xl border border-[#e3e7e2] bg-white p-7 text-[#69736c]">No pending answers in this queue.</p>}
    <div className="space-y-6">{visible.map((answer) => <article key={answer.id} className="rounded-[2rem] border border-[#e3e7e2] bg-white p-7 sm:p-10">
      <div className="flex flex-wrap items-center gap-3 text-xs text-[#69736c]">
        <span className="rounded-full bg-[#f4f7f0] px-3 py-1 font-semibold">{answer.status}</span>
        <time dateTime={answer.created_at}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(answer.created_at))} UTC</time>
      </div>
      <h2 className="mt-4 break-words text-xl font-semibold">Question: {answer.question_title}</h2>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-[#56625a]">{answer.body}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={() => decide(answer.id, "approved")} className="rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50">Approve</button>
        <button type="button" disabled={busy} onClick={() => decide(answer.id, "rejected")} className="rounded-full border border-[#dce2dc] px-5 py-3 text-sm font-semibold text-[#a1432d] disabled:cursor-wait disabled:opacity-50">Reject</button>
      </div>
    </article>)}</div>
  </div>;
}
