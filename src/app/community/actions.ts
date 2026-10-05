"use server";
import { createClient } from "@/lib/supabase/server";
import { uuid, validatePost, reportReasons, type ActionResult, type PostInput } from "@/lib/community";
import { revalidatePath } from "next/cache";
const failure = { ok: false, message: "We couldn’t save this. Please refresh and try again." };
export async function submitCommunityPost(form: FormData): Promise<ActionResult> {
  try {
    const input = Object.fromEntries(["type","title","body","topic","image_id","image_alt","location_label"].map(key => [key, typeof form.get(key) === "string" ? (form.get(key) as string).trim() : ""])) as PostInput;
    const errorMessage = validatePost(input);
    if (errorMessage) return { ok: false, message: errorMessage };
    const client = await createClient();
    const { data, error: authError } = await client.auth.getUser();
    if (authError || !data.user) return { ok: false, message: "Please log in again before sharing." };
    // Explicit whitelist. No submitted identity, status, feature flag or timestamps.
    const { error } = await client.from("community_posts").insert({ author_id: data.user.id, type: input.type, title: input.title || null, body: input.body, topic: input.topic || null, image_id: input.image_id || null, image_alt: input.image_alt || null, location_label: input.location_label || null });
    if (error) return failure;
    revalidatePath("/account/contributions");
    return { ok: true, message: "Thanks for sharing. Your post is being reviewed before it appears in the community." };
  } catch { return failure; }
}
export async function setHelpful(id: string, enabled: boolean): Promise<ActionResult> {
  if (!uuid.test(id) || typeof enabled !== "boolean") return failure;
  try {
    const client = await createClient();
    const { data, error: authError } = await client.auth.getUser();
    if (authError || !data.user) return { ok: false, message: "Log in to mark a post helpful." };
    const { data: allowed, error: allowedError } = await client.rpc("community_can_help", { target: id });
    if (allowedError || !allowed) return { ok: false, message: "Helpful is available for other members’ published posts." };
    const result = enabled ? await client.from("community_helpful").insert({ post_id: id }) : await client.from("community_helpful").delete().eq("post_id", id).eq("reaction_type", "helpful");
    if (result.error && !(enabled && result.error.code === "23505")) return failure;
    revalidatePath(`/community/posts/${id}`);
    return { ok: true, message: enabled ? "Marked helpful." : "Helpful removed." };
  } catch { return failure; }
}
export async function reportPost(id: string, form: FormData): Promise<ActionResult> {
  const reason = form.get("reason"), details = form.get("details");
  if (!uuid.test(id) || typeof reason !== "string" || !reportReasons.includes(reason as typeof reportReasons[number]) || typeof details !== "string" || Array.from(details).length > 1000) return failure;
  try {
    const client = await createClient();
    const { data, error: authError } = await client.auth.getUser();
    if (authError || !data.user) return { ok: false, message: "Please log in to report this content." };
    const { data: post, error: postError } = await client.from("community_posts").select("id").eq("id", id).eq("status", "approved").maybeSingle();
    if (postError || !post) return failure;
    const { error } = await client.from("community_reports").insert({ post_id: id, reason, details: details.trim() || null });
    if (error && error.code !== "23505") return failure;
    return { ok: true, message: "Your report has been received for review." };
  } catch { return failure; }
}
