import "server-only";
import { createClient } from "@/lib/supabase/server";
import { validateAnswer, type AnswerResult } from "@/lib/answers";

// Called only by the detail page's Server Action with its captured question ID.
export async function submitAnswer(questionId: string, formData: FormData): Promise<AnswerResult> {
  try {
    const client = await createClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return {
      ok: false, loginRequired: true, message: "Please log in again before submitting your answer.",
    };
    const body = formData.get("body");
    if (typeof body !== "string") return { ok: false, message: "Please enter an answer." };
    const validation = validateAnswer(body);
    if (validation) return { ok: false, message: validation };

    // Recheck current eligibility, even if the author/admin can read private rows.
    const { data: question, error: questionError } = await client.from("questions")
      .select("id").eq("id", questionId).eq("status", "approved").maybeSingle();
    if (questionError || !question) return {
      ok: false, message: "This question is unavailable for answers. Please return to Ask a Local.",
    };
    // RLS remains authoritative. No RETURNING, client identity, or moderation fields.
    const { error } = await client.from("answers").insert({
      question_id: question.id,
      author_id: auth.user.id,
      body: body.trim(),
    });
    if (error) return { ok: false, message: "We couldn’t submit your answer. Please try again later." };
    return { ok: true, message: "Answer submitted for review." };
  } catch {
    return { ok: false, message: "We couldn’t confirm your submission. Please check your connection before trying again." };
  }
}
