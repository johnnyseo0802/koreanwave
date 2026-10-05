import "server-only";
import { createClient } from "@/lib/supabase/server";
import { publicPostFields, type CommunityPost } from "@/lib/community";
import { conversationId, type Activity, type Comment } from "@/lib/conversation";
export async function conversationData(postId: string) {
  const fallback = { authenticated: false, comments: [] as Comment[], own: [] as Comment[], mine: [] as string[], counts: {} as Record<string, number>, unavailable: true };
  if (!conversationId.test(postId)) return fallback;
  try {
    const client = await createClient();const auth = await client.auth.getUser();
    const authenticated = !auth.error && !!auth.data.user;
    const post = await client.from("community_posts").select("id").eq("id", postId).eq("status", "approved").maybeSingle();
    if (post.error || !post.data) return fallback;
    // Explicit public filter even for owners/admins. Roots first so replies cannot
    // orphan their parent when bounded. Private roots are never serialized.
    // Fetch newest bounded windows so a newly posted contribution is not silently
    // excluded behind the oldest 30/100 rows. Render each window oldest-to-newest.
    const roots = await client.from("community_comments").select("id,parent_comment_id,body,status,created_at").eq("post_id", postId).eq("status", "approved").is("parent_comment_id", null).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(30);
    if (roots.error) return { ...fallback, authenticated };
    const ids = (roots.data ?? []).map(c => c.id);
    const replies = ids.length ? await client.from("community_comments").select("id,parent_comment_id,body,status,created_at").eq("post_id", postId).eq("status", "approved").in("parent_comment_id", ids).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100) : { data: [], error: null };
    const counts = await client.rpc("conversation_reaction_counts", { target: postId });
    const mine = authenticated ? await client.from("community_helpful").select("reaction_type").eq("post_id", postId) : { data: [], error: null };
    const own = authenticated ? await client.rpc("my_conversation_comments", { target: postId }) : { data: [], error: null };
    return { authenticated, comments: [...(roots.data ?? [])].reverse().concat([...(replies.data ?? [])].reverse()) as Comment[], own: (own.data ?? []) as Comment[], mine: (mine.data ?? []).map(r => r.reaction_type as string), counts: Object.fromEntries((counts.data ?? []).map((r: { kind: string; total: number }) => [r.kind, Number(r.total)])), unavailable: !!(replies.error || counts.error || mine.error || own.error) };
  } catch { return fallback; }
}
export async function trendingConversations(limit = 30) {
  try {
    const client = await createClient();const result = await client.rpc("trending_conversations");
    if (result.error) return null;
    const stats = (result.data ?? []).slice(0, Math.min(limit, 30)) as Activity[];
    if (!stats.length) return [];
    const posts = await client.from("community_posts").select(publicPostFields).eq("status", "approved").in("id", stats.map(s => s.post_id));
    if (posts.error) return null;
    return stats.flatMap(stat => {
      const post = (posts.data as CommunityPost[] ?? []).find(p => p.id === stat.post_id);
      return post ? [{ post, stat }] : [];
    });
  } catch { return null; }
}
export async function articleConversation(articleId: string) {
  if (!conversationId.test(articleId)) return null;
  try {
    const client = await createClient();
    const r = await client.from("article_discussions").select("post:community_posts!inner(id,title,status,type),article:editorial_articles!inner(status)").eq("article_id", articleId).eq("article.status", "published").eq("post.status", "approved").eq("post.type", "discussion").maybeSingle();
    if (r.error || !r.data) return null;
    return (r.data as unknown as { post: { id: string; title: string } }).post;
  } catch { return null; }
}
