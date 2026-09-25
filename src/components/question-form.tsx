"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { submitQuestion } from "@/app/write/question/actions";
import { questionLength, validateQuestion } from "@/lib/questions";

const inputClass = "mt-2 w-full rounded-xl border border-[#e0e5e0] bg-white px-4 py-3 text-sm outline-none focus:border-[#789a50] focus:ring-2 focus:ring-[#dbe4d7]";

export function QuestionForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || feedback?.ok) return;
    const validation = validateQuestion({ title, body });
    if (validation) { setFeedback({ ok: false, message: validation }); return; }
    const formData = new FormData(event.currentTarget);
    submitting.current = true;
    setPending(true);
    setFeedback(null);
    let succeeded = false;
    try {
      const result = await submitQuestion(formData);
      succeeded = result.ok;
      setFeedback(result);
      if (result.ok) { setTitle(""); setBody(""); }
    } catch {
      setFeedback({ ok: false, message: "We couldn’t confirm your submission. Please check your connection before trying again." });
    } finally {
      if (!succeeded) submitting.current = false;
      setPending(false);
    }
  }

  if (feedback?.ok) return <section role="status" className="rounded-[2rem] border border-[#e3e7e2] bg-[#f4f7f0] p-7 sm:p-10">
    <h2 className="text-xl font-semibold">{feedback.message}</h2>
    <p className="mt-3 text-sm leading-6 text-[#69736c]">Your question will only become public after approval.</p>
    <Link href="/" className="mt-6 inline-block rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white">Back to Home</Link>
  </section>;

  return <form onSubmit={submit} aria-busy={pending} className="rounded-[2rem] border border-[#e3e7e2] bg-white p-7 sm:p-10">
    <fieldset disabled={pending} className="grid gap-6">
      <legend className="sr-only">Ask a Local question</legend>
      <label htmlFor="question-title" className="text-sm font-medium">Title
        <input id="question-title" name="title" required value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} aria-describedby="title-count" aria-invalid={questionLength(title) > 160} />
        <span id="title-count" className="mt-2 block text-xs text-[#717a74]">{questionLength(title)} / 160 characters · Minimum 5, excluding surrounding spaces</span>
      </label>
      <label htmlFor="question-body" className="text-sm font-medium">Question
        <textarea id="question-body" name="body" required rows={10} value={body} onChange={(event) => setBody(event.target.value)} className={inputClass} aria-describedby="question-count" aria-invalid={questionLength(body) > 5000} />
        <span id="question-count" className="mt-2 block text-xs text-[#717a74]">{questionLength(body)} / 5,000 characters · Minimum 10, excluding surrounding spaces</span>
      </label>
    </fieldset>
    <p className="mt-5 text-sm leading-6 text-[#69736c]">Questions are reviewed before publication. Please don’t include private contact details or sensitive personal information.</p>
    {feedback && <p role="alert" className="mt-4 rounded-xl bg-[#fdf0ed] p-3 text-sm text-[#a1432d]">{feedback.message}</p>}
    <button type="submit" disabled={pending} className="mt-6 rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">{pending ? "Submitting…" : "Submit for review"}</button>
  </form>;
}
