import "server-only";
import { createClient } from "@/lib/supabase/server";
import { publicPostFields, type CommunityPost, uuid } from "@/lib/community";
export async function publicPosts(type?: string, featured = false): Promise<CommunityPost[] | null> {
  try {
    const client = await createClient();
    let query = client.from("community_posts").select(publicPostFields).eq("status", "approved");
    if (type) query = query.eq("type", type);
    if (featured) query = query.eq("is_featured", true);
    const { data, error } = await query.order("published_at", { ascending: false }).order("id").limit(featured ? 6 : 30);
    return error ? null : data as unknown as CommunityPost[];
  } catch { return null; }
}
export async function publicPost(id: string): Promise<CommunityPost | null> {
  if (!uuid.test(id)) return null;
  try {
    const client = await createClient();
    const { data, error } = await client.from("community_posts").select(publicPostFields).eq("id", id).eq("status", "approved").maybeSingle();
    return error ? null : data as unknown as CommunityPost;
  } catch { return null; }
}
export async function weeklyPrompt() {
  try {
    const client = await createClient();
    const { data, error } = await client.from("community_prompt").select("prompt,suggested_type").eq("id", true).maybeSingle();
    return error ? null : data as { prompt: string; suggested_type: string } | null;
  } catch { return null; }
}
export type FeedCard = { id: string; title: string; body: string; href: string; type: string; published_at: string | null; image_id?: string | null; image_alt?: string | null; is_featured?: boolean };
export async function communityFeed(filter: string): Promise<{ cards: FeedCard[]; unavailable: boolean }> {
  let unavailable = false;
  const cards: FeedCard[] = [];
  if (!["questions", "reviews"].includes(filter)) {
    const posts = await publicPosts(filter === "all" ? undefined : filter);
    if (!posts) unavailable = true;
    for (const p of posts ?? []) cards.push({ ...p, title: p.title ?? "Korea Moment", href: `/community/posts/${p.id}` });
  }
  try {
    const client = await createClient();
    if (["all", "questions"].includes(filter)) {
      const { data, error } = await client.from("questions").select("id,title,body,published_at").eq("status", "approved").order("published_at", { ascending: false }).limit(30);
      if (error) unavailable = true;
      for (const q of data ?? []) cards.push({ ...q, type: "question", href: `/community/questions/${q.id}` });
    }
    if (["all", "reviews"].includes(filter)) {
      const { data, error } = await client.from("reviews").select("id,place_id,body,published_at,places!inner(status)").eq("status", "approved").eq("places.status", "published").order("published_at", { ascending: false }).limit(30);
      if (error) unavailable = true;
      for (const r of data ?? []) cards.push({ id: r.id, title: "A visitor’s review", body: r.body, published_at: r.published_at, type: "review", href: `/local-korea/places/${r.place_id}` });
    }
  } catch { unavailable = true; }
  return { cards: cards.sort((a,b) => (b.published_at ?? "").localeCompare(a.published_at ?? "")).slice(0,30), unavailable };
}
