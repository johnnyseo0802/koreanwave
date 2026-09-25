"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { answerLength, validateAnswer, type AnswerResult } from "@/lib/answers";

export function AnswerForm({ submitAction, loginHref }: {
  submitAction: (formData: FormData) => Promise<AnswerResult>;
  loginHref: string;
}) {
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const locked = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || feedback?.ok || feedback?.loginRequired) return;
    const validation = validateAnswer(body);
    if (validation) { setFeedback({ ok: false, message: validation }); return; }
    const formData = new FormData(event.currentTarget);
    locked.current = true;
    setPending(true);
    setFeedback(null);
    let succeeded = false;
    try {
      const result = await submitAction(formData);
      succeeded = result.ok;
      setFeedback(result);
      if (result.ok) setBody("");
    } catch {
      setFeedback({ ok: false, message: "We couldn’t confirm your submission. Please check your connection before trying again." });
    } finally {
      if (!succeeded) locked.current = false;
      setPending(false);
    }
  }

  return <section className="mt-8 rounded-[2rem] border border-[#e3e7e2] bg-white p-7 sm:p-10">
    <h2 className="text-xl font-semibold">Share an answer</h2>
    <p className="mt-3 text-sm leading-6 text-[#69736c]">Answers appear publicly only after approval. Please avoid sharing private contact details.</p>
    {feedback?.ok ? <p role="status" className="mt-5 rounded-xl bg-[#f4f7f0] p-4 text-sm text-[#3d5630]">{feedback.message} It will appear publicly after approval.</p> : <form onSubmit={submit} aria-busy={pending} className="mt-6">
      <label htmlFor="answer-body" className="text-sm font-medium">Your answer</label>
      <textarea id="answer-body" name="body" required rows={7} disabled={pending || feedback?.loginRequired} value={body} onChange={(event) => setBody(event.target.value)} aria-describedby="answer-count" aria-invalid={answerLength(body) > 5000} className="mt-2 w-full rounded-xl border border-[#e0e5e0] px-4 py-3 text-sm outline-none focus:border-[#789a50] focus:ring-2 focus:ring-[#dbe4d7]" />
      <p id="answer-count" className="mt-2 text-xs text-[#717a74]">{answerLength(body)} / 5,000 characters · Minimum 2, excluding surrounding spaces</p>
      {feedback && <p role="alert" className="mt-4 rounded-xl bg-[#fdf0ed] p-3 text-sm text-[#a1432d]">{feedback.message}</p>}
      {feedback?.loginRequired ? <Link href={loginHref} className="mt-5 inline-block text-sm font-semibold underline">Log in to answer</Link> : <button type="submit" disabled={pending} className="mt-6 rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">{pending ? "Submitting…" : "Submit answer"}</button>}
    </form>}
  </section>;
}
