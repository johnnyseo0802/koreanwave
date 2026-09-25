import { notFound, redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { QuestionModerationQueue, type PendingQuestion } from "@/components/question-moderation-queue";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AdminModerationNav } from "@/components/admin-moderation-nav";

export default async function AdminQuestionsPage() {
  const access = await getAdminAccess();
  if (access.status === "unauthenticated") redirect("/login?next=/admin/questions");
  if (access.status !== "admin") notFound();

  let questions: PendingQuestion[] | null = null;
  try {
    const { data, error } = await access.client.from("questions")
      .select("id,title,body,created_at,status").eq("status", "pending")
      .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(100);
    if (!error && data) questions = data;
  } catch {
    // Fail safely without logging private content or database errors.
  }
  return <main className="min-h-screen bg-[#fcfcfa] text-[#18201d]">
    <SiteHeader />
    <section className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-20">
      <AdminModerationNav active="questions" />
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#557b39]">Community moderation</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em]">Pending questions</h1>
      <p className="mt-4 text-base leading-7 text-[#69736c]">Review Ask a Local submissions. Approval publishes a question; rejection keeps it private. Decisions cannot be reversed here.</p>
      <p className="mt-2 text-sm text-[#69736c]">Showing up to 100 oldest pending questions. The queue refreshes after each decision.</p>
      {questions ? <QuestionModerationQueue questions={questions} /> : <p role="alert" className="mt-8 rounded-2xl bg-white p-6">We couldn’t load the queue. Please refresh the page or try again later.</p>}
    </section>
    <SiteFooter />
  </main>;
}
