import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { createClient } from "@/lib/supabase/server";
import { AnswerForm } from "@/components/answer-form";
import { PublicAnswers } from "@/components/public-answers";
import { submitAnswer } from "@/lib/submit-answer";

type PublicQuestion = { id: string; title: string; body: string; published_at: string };

export default async function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  let question: PublicQuestion | null = null;
  try {
    const client = await createClient();
    // Mandatory even for authors/admins: this route never reads private questions.
    const { data, error } = await client.from("questions")
      .select("id,title,body,published_at")
      .eq("id", id).eq("status", "approved").maybeSingle();
    if (!error && data) question = data;
  } catch {
    // Fail closed without exposing database errors or private existence details.
  }
  // Outside try/catch because notFound throws a Next.js control-flow exception.
  if (!question) notFound();

  let authenticated = false;
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    authenticated = !error && !!data.user;
  } catch {
    // Keep the approved question public even when authentication is unavailable.
  }
  const questionId = question.id;
  const loginHref = `/login?next=${encodeURIComponent(`/community/questions/${questionId}`)}`;
  async function answerAction(formData: FormData) {
    "use server";
    // Next.js encrypts this closure's captured page ID; no editable ID form field.
    // The helper still checks live authentication and approved parent eligibility.
    return submitAnswer(questionId, formData);
  }

  return <main className="min-h-screen bg-[#fcfcfa] text-[#18201d]">
    <SiteHeader />
    <article className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#557b39]">Community / Ask a Local</p>
      <h1 className="mt-4 break-words text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">{question.title}</h1>
      <p className="mt-5 text-sm text-[#69736c]">Published <time dateTime={question.published_at}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(question.published_at))}</time></p>
      <div className="mt-8 rounded-[2rem] border border-[#e3e7e2] bg-white p-7 sm:p-10">
        <p className="whitespace-pre-wrap break-words text-base leading-8 text-[#56625a]">{question.body}</p>
      </div>
      <PublicAnswers questionId={questionId} />
      <Link href="/community/questions" className="mt-8 inline-block rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white">← Back to Ask a Local</Link>
      {authenticated ? <AnswerForm key={questionId} submitAction={answerAction} loginHref={loginHref} /> : <section className="mt-8 rounded-[2rem] border border-[#e3e7e2] bg-white p-7 sm:p-10">
        <h2 className="text-xl font-semibold">Have a helpful answer?</h2>
        <p className="mt-3 text-sm leading-6 text-[#69736c]">Log in to share your knowledge. Answers appear publicly only after approval.</p>
        <Link href={loginHref} className="mt-5 inline-block rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white">Log in to answer</Link>
      </section>}
    </article>
    <SiteFooter />
  </main>;
}
