"use server";
import { createClient } from "@/lib/supabase/server";
import { commentError, conversationId, reactionKinds, type ReactionKind } from "@/lib/conversation";
import { reportReasons } from "@/lib/community";
import { revalidatePath } from "next/cache";
const failure = { ok: false, message: "This conversation is unavailable or your session has expired. Refresh and try again." };
function refresh(id: string) { for (const path of ["/", "/community", "/admin/conversations", `/community/posts/${id}`]) revalidatePath(path); }
export async function submitComment(postId: string, parent: string | null, form: FormData) {
  if (!conversationId.test(postId) || (parent !== null && !conversationId.test(parent)) || !(form instanceof FormData)) return failure;
  const body = form.get("body"), error = commentError(body);
  if (error) return { ok: false, message: error };
  try {
    const client = await createClient();
    const { data, error: authError } = await client.auth.getUser();
    if (authError || !data.user) return { ok: false, message: "Please log in again to add your take." };
    const post = await client.from("community_posts").select("id").eq("id", postId).eq("status", "approved").maybeSingle();
    if (post.error || !post.data) return failure;
    if (parent) {
      const root = await client.from("community_comments").select("id").eq("id", parent).eq("post_id", postId).eq("status", "approved").is("parent_comment_id", null).maybeSingle();
      if (root.error || !root.data) return failure;
    }
    // DB auth.uid() default owns identity. No author/status/timestamps from form.
    const saved = await client.from("community_comments").insert({ post_id: postId, parent_comment_id: parent, body: (body as string).trim() });
    if (saved.error) return { ok: false, message: "Could not submit. Please wait a moment, refresh and check your submissions before retrying." };
    refresh(postId); return { ok: true, message: parent ? "Your reply is live." : "Your comment is live." };
  } catch { return failure; }
}
export async function reactToPost(postId: string, kind: string, enabled: boolean) {
  if (!conversationId.test(postId) || !reactionKinds.includes(kind as ReactionKind) || typeof enabled !== "boolean") return failure;
  try {
    const client = await createClient();const auth = await client.auth.getUser();
    if (auth.error || !auth.data.user) return { ok: false, message: "Log in to react." };
    const allowed = await client.rpc("community_can_help", { target: postId });
    if (allowed.error || !allowed.data) return { ok: false, message: "React to another member’s published contribution." };
    const r = enabled ? await client.from("community_helpful").insert({ post_id: postId, reaction_type: kind })
      : await client.from("community_helpful").delete().eq("post_id", postId).eq("reaction_type", kind);
    if (r.error && !(enabled && r.error.code === "23505")) return failure;
    refresh(postId);return { ok: true, message: enabled ? "Reaction added." : "Reaction removed." };
  } catch { return failure; }
}
export async function reportComment(postId: string, commentId: string, form: FormData) {
  if (!conversationId.test(postId) || !conversationId.test(commentId) || !(form instanceof FormData)) return failure;
  const reason = form.get("reason"), details = form.get("details");
  if (typeof reason !== "string" || !reportReasons.includes(reason as typeof reportReasons[number]) || typeof details !== "string" || Array.from(details).length > 1000) return failure;
  try {
    const client = await createClient();const auth = await client.auth.getUser();
    if (auth.error || !auth.data.user) return failure;
    const r = await client.from("community_reports").insert({ post_id: postId, comment_id: commentId, reason, details: details.trim() || null });
    if (r.error && r.error.code !== "23505") return failure;
    return { ok: true, message: "Report received. Disagreement is welcome; abuse is reviewed." };
  } catch { return failure; }
}
