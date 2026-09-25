import { notFound, redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { AnswerModerationQueue, type PendingAnswer } from "@/components/answer-moderation-queue";
import { AdminModerationNav } from "@/components/admin-moderation-nav";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default async function AdminAnswersPage() {
  const access = await getAdminAccess();
  if (access.status === "unauthenticated") redirect("/login?next=/admin/answers");
  if (access.status !== "admin") notFound();
  let answers: PendingAnswer[] | null = null;
  try {
    const { data, error } = await access.client.from("answers")
      .select("id,question_id,body,created_at,status").eq("status", "pending")
      .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(100);
    if (!error && data) {
      const ids = [...new Set(data.map((answer) => answer.question_id))];
      const titles = new Map<string, string>();
      if (ids.length) {
        const context = await access.client.from("questions").select("id,title").in("id", ids);
        if (context.error) throw new Error("Question context unavailable");
        for (const question of context.data ?? []) titles.set(question.id, question.title);
      }
      answers = data.map((answer) => ({
        id: answer.id, body: answer.body, created_at: answer.created_at,
        status: answer.status, question_title: titles.get(answer.question_id) ?? "Question unavailable",
      }));
    }
  } catch {
    // Do not expose private data or raw database errors.
  }
  return <main className="min-h-screen bg-[#fcfcfa] text-[#18201d]">
    <SiteHeader />
    <section className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-20">
      <AdminModerationNav active="answers" />
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#557b39]">Community moderation</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em]">Pending answers</h1>
      <p className="mt-4 text-base leading-7 text-[#69736c]">Review answers before publication. Decisions cannot be reversed here.</p>
      <p className="mt-2 text-sm text-[#69736c]">Showing up to 100 oldest pending answers. The queue refreshes after each decision.</p>
      {answers ? <AnswerModerationQueue answers={answers} /> : <p role="alert" className="mt-8 rounded-2xl bg-white p-6">We couldn’t load the queue. Please refresh the page or try again later.</p>}
    </section>
    <SiteFooter />
  </main>;
}
