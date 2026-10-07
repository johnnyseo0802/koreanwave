import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { TranslationRequest } from "@/lib/translation";

/** Normal cookie client + explicit public filters, EVEN for owners/admins.
 * No private identities or profile fields are selected. Never use elevated reads. */
export async function translationSource(client: Awaited<ReturnType<typeof createClient>>, request: TranslationRequest): Promise<string | null> {
  if (request.contentType === "post") {
    const r = await client.from("community_posts").select("body")
      .eq("id", request.contentId).eq("status", "approved")
      .in("type", ["discussion", "moment", "story", "tip"]).maybeSingle();
    return r.error ? null : r.data?.body ?? null;
  }
  const r = await client.from("community_comments").select("body,post_id,parent_comment_id")
    .eq("id", request.contentId).eq("status", "approved").maybeSingle();
  if (r.error || !r.data) return null;
  const post = await client.from("community_posts").select("id").eq("id", r.data.post_id).eq("status", "approved").maybeSingle();
  if (post.error || !post.data) return null;
  if (r.data.parent_comment_id) {
    const root = await client.from("community_comments").select("id")
      .eq("id", r.data.parent_comment_id).eq("post_id", r.data.post_id)
      .eq("status", "approved").is("parent_comment_id", null).maybeSingle();
    if (root.error || !root.data) return null;
  }
  return r.data.body;
}
