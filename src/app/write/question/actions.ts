"use server";

import { createClient } from "@/lib/supabase/server";
import { validateQuestion } from "@/lib/questions";

export async function submitQuestion(formData: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const client = await createClient();
    const { data, error: authError } = await client.auth.getUser();
    if (authError || !data.user) {
      return { ok: false, message: "Please log in again before submitting your question." };
    }
    const title = formData.get("title");
    const body = formData.get("body");
    if (typeof title !== "string" || typeof body !== "string") {
      return { ok: false, message: "Please enter both a title and a question." };
    }
    const input = { title: title.trim(), body: body.trim() };
    const validation = validateQuestion(input);
    if (validation) return { ok: false, message: validation };

    // Identity comes only from Auth. DB defaults and RLS enforce moderation state.
    const { error } = await client.from("questions").insert({
      author_id: data.user.id,
      title: input.title,
      body: input.body,
    });
    if (error) return { ok: false, message: "We couldn’t submit your question. Please try again later." };
    return { ok: true, message: "Your question has been submitted for review." };
  } catch {
    return { ok: false, message: "We couldn’t confirm your submission. Please check your connection before trying again." };
  }
}
