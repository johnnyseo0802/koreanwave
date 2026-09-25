export const metadata = { title: "Ask a question" };

import { QuestionForm } from "@/components/question-form";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { requireUser } from "@/lib/auth/require-user";

export default async function QuestionPage() {
  await requireUser("/write/question");
  return <main className="min-h-screen bg-[#fcfcfa] text-[#18201d]">
    <SiteHeader />
    <section className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#557b39]">Ask a Local</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">Ask a Question</h1>
      <p className="mb-8 mt-4 text-base leading-7 text-[#69736c]">Planning a visit or curious about everyday life in Korea? Ask the community.</p>
      <QuestionForm />
    </section>
    <SiteFooter />
  </main>;
}
