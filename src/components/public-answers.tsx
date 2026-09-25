import { createClient } from "@/lib/supabase/server";

type PublicAnswer = { id: string; body: string; published_at: string };

// Called only after the parent page has verified an approved question.
export async function PublicAnswers({ questionId }: { questionId: string }) {
  let answers: PublicAnswer[] | null = null;
  try {
    const client = await createClient();
    const { data, error } = await client.from("answers")
      .select("id,body,published_at").eq("question_id", questionId)
      .eq("status", "approved").order("published_at", { ascending: true });
    if (!error && data) answers = data;
  } catch {
    // Distinguish failed reads from an empty list without exposing DB details.
  }
  return <section aria-labelledby="published-answers-heading" className="mt-10">
    <h2 id="published-answers-heading" className="text-2xl font-semibold">Answers</h2>
    {answers === null ? <p role="alert" className="mt-4 rounded-2xl border border-[#e3e7e2] bg-white p-6 text-sm text-[#69736c]">We couldn’t load the answers. Please refresh the page or try again later.</p>
      : !answers.length ? <p className="mt-4 rounded-2xl border border-[#e3e7e2] bg-white p-6 text-sm text-[#69736c]">No answers have been published yet.</p>
      : <div className="mt-4 space-y-4">{answers.map((answer) => <article key={answer.id} className="rounded-2xl border border-[#e3e7e2] bg-white p-6 sm:p-8">
        <p className="text-xs text-[#557b39]">Published <time dateTime={answer.published_at}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(answer.published_at))}</time></p>
        <p className="mt-4 whitespace-pre-wrap break-words text-base leading-8 text-[#56625a]">{answer.body}</p>
      </article>)}</div>}
  </section>;
}
