export const metadata = { title: "Ask a Local" };

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { createClient } from "@/lib/supabase/server";

type PublicQuestion = { id: string; title: string; body: string; published_at: string };

export default async function QuestionsPage() {
  let questions: PublicQuestion[] | null = null;
  try {
    const client = await createClient();
    // Explicit public filter is required even for authors/admins whose RLS
    // permits reading additional private questions. Never select author data.
    const { data, error } = await client.from("questions")
      .select("id,title,body,published_at")
      .eq("status", "approved")
      .order("published_at", { ascending: false });
    if (!error && data) questions = data;
  } catch {
    // Render a safe error, not private Supabase details or a misleading empty list.
  }

  return <main className="min-h-screen bg-[#fcfcfa] text-[#18201d]">
    <SiteHeader />
    <section className="border-y border-[#e4e8e1] bg-[#f4f7f0]">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#557b39]">Community / Ask a Local</p>
        <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">Ask a Local</h1>
            <p className="mt-4 text-base leading-7 text-[#69736c]">Bring your Korea questions to a community that loves to share what it knows.</p>
          </div>
          <Link href="/write/question" className="w-fit rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white">Ask a question →</Link>
        </div>
      </div>
    </section>
    <section aria-label="Published questions" className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
      {questions === null ? <p role="alert" className="rounded-2xl border border-[#e3e7e2] bg-white p-7 text-sm text-[#69736c]">We couldn’t load the questions. Please refresh the page or try again later.</p>
        : questions.length === 0 ? <p className="rounded-2xl border border-[#e3e7e2] bg-white p-7 text-[#69736c]">No questions have been published yet.</p>
        : <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">{questions.map((question) => <article key={question.id} className="rounded-2xl border border-[#e3e7e2] bg-white p-6 sm:p-7">
          <p className="text-xs font-medium text-[#557b39]">Published <time dateTime={question.published_at}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(question.published_at))}</time></p>
          <h2 className="mt-4 break-words text-xl font-semibold tracking-[-0.02em]"><Link href={`/community/questions/${question.id}`} className="rounded-sm hover:text-[#557b39] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#789a50]">{question.title}</Link></h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#69736c]">{question.body}</p>
        </article>)}</div>}
    </section>
    <SiteFooter />
  </main>;
}
