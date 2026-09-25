import "server-only";
import { createClient } from "@/lib/supabase/server";
import { validateReview, type ReviewResult } from "@/lib/reviews";

// Called only by the detail page's Server Action with its captured place ID.
export async function submitReview(placeId: string, formData: FormData): Promise<ReviewResult> {
  try {
    const client = await createClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return {
      ok: false, loginRequired: true, message: "Please log in again before submitting your review.",
    };
    const body = formData.get("body");
    if (typeof body !== "string") return { ok: false, message: "Please enter a review." };
    const validation = validateReview(body);
    if (validation) return { ok: false, message: validation };

    // Recheck current eligibility, even if the author/admin can read private rows.
    const { data: place, error: placeError } = await client.from("places")
      .select("id").eq("id", placeId).eq("status", "published").maybeSingle();
    if (placeError || !place) return {
      ok: false, message: "This place is unavailable for reviews. Please return to Places.",
    };
    // RLS remains authoritative. No RETURNING, client identity, or moderation fields.
    const { error } = await client.from("reviews").insert({
      place_id: place.id,
      author_id: auth.user.id,
      body: body.trim(),
    });
    if (error) return { ok: false, message: "We couldn’t submit your review. Please try again later." };
    return { ok: true, message: "Review submitted for review." };
  } catch {
    return { ok: false, message: "We couldn’t confirm your submission. Please check your connection before trying again." };
  }
}
