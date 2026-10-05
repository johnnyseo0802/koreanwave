"use server";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { commentError, conversationId } from "@/lib/conversation";
import { revalidatePath } from "next/cache";
const failure = { ok: false, message: "Could not save. Refresh and check administrator access." };
const refresh = () => revalidatePath("/", "layout");
export async function createDiscussion(form: FormData) {
  if (!(form instanceof FormData)) return failure;
  const title = form.get("title"), body = form.get("body");
  if (typeof title !== "string" || Array.from(title.trim()).length < 2 || Array.from(title.trim()).length > 160 || commentError(body)) return { ok: false, message: "Use a title of 2–160 and body of 2–2,000 characters." };
  const access = await getAdminAccess();if (access.status !== "admin") return failure;
  try {
    const auth = await access.client.auth.getUser();if (auth.error || !auth.data.user) return failure;
    const r = await access.client.from("community_posts").insert({ author_id: auth.data.user.id, type: "discussion", title: title.trim(), body: (body as string).trim() });
    if (r.error) return failure;refresh();return { ok: true, message: "Discussion submitted to the existing pending queue. Review before approval." };
  } catch { return failure; }
}
export async function moderateComment(id: string, from: string, decision: string) {
  if (!conversationId.test(id) || !["pending", "approved"].includes(from) || !["approved", "rejected"].includes(decision) || (from === "approved" && decision !== "rejected")) return failure;
  const access = await getAdminAccess();if (access.status !== "admin") return failure;
  try {
    const r = await access.client.from("community_comments").update({ status: decision }).eq("id", id).eq("status", from).select("id").maybeSingle();
    if (r.error || !r.data) return { ok: false, message: "Comment changed, its context is hidden, or it is unavailable. Refresh the queue." };
    refresh();return { ok: true, message: decision === "approved" ? "Comment approved." : "Comment hidden/rejected. Replies are also hidden publicly." };
  } catch { return failure; }
}
export async function hideConversationPost(id: string) {
  if (!conversationId.test(id)) return failure;
  const access = await getAdminAccess();if (access.status !== "admin") return failure;
  try {
    const r = await access.client.from("community_posts").update({ status: "rejected" }).eq("id", id).eq("status", "approved").select("id").maybeSingle();
    if (r.error || !r.data) return failure;refresh();return { ok: true, message: "Post hidden. Its public conversation and media are no longer available." };
  } catch { return failure; }
}
export async function linkArticleDiscussion(form: FormData) {
  if (!(form instanceof FormData)) return failure;
  const article = form.get("article_id"), post = form.get("post_id"), previous = form.get("previous_post_id");
  if (typeof article !== "string" || !conversationId.test(article) || typeof post !== "string" || !conversationId.test(post) || typeof previous !== "string" || (previous && !conversationId.test(previous))) return failure;
  const access = await getAdminAccess();if (access.status !== "admin") return failure;
  try {
    const p = await access.client.from("community_posts").select("id").eq("id", post).eq("type", "discussion").eq("status", "approved").maybeSingle();
    if (p.error || !p.data) return failure;
    const q = previous ? access.client.from("article_discussions").update({ post_id: post }).eq("article_id", article).eq("post_id", previous)
      : access.client.from("article_discussions").insert({ article_id: article, post_id: post });
    const r = await q.select("article_id").maybeSingle();
    if (r.error || !r.data) return { ok: false, message: "Link changed or already exists. Reload before retrying." };
    refresh();return { ok: true, message: "Discussion linked. Draft articles remain private." };
  } catch { return failure; }
}
