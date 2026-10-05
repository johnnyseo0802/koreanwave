import Link from "next/link";
import { notFound } from "next/navigation";
import { publicPost } from "@/lib/community-data";
import { createClient } from "@/lib/supabase/server";
import { CommunityShell, CommunityImage } from "@/components/community-shell";
import { CommunityInteractions } from "@/components/community-interactions";
import { PostConversation } from "@/components/conversation";
export const metadata = { title: "Community contribution" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await publicPost(id); if (!post) notFound();
  let authenticated = false, helpful = false, total = 0, unavailable = false;
  try {
    const client = await createClient();
    const { data: auth, error } = await client.auth.getUser(); authenticated = !error && !!auth.user;
    const counts = await client.rpc("community_helpful_counts", { targets: [id] });
    if (counts.error) unavailable = true; else total = Number(counts.data?.[0]?.total ?? 0);
    if (authenticated) { const own = await client.from("community_helpful").select("post_id").eq("post_id",id).eq("reaction_type","helpful").maybeSingle(); helpful = !!own.data; }
  } catch { unavailable = true; }
  return <CommunityShell title={post.title ?? "Korea Moment"} description={`Korea ${post.type}${post.is_featured ? " · Featured" : ""}`}><article className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 sm:p-9">
    {post.image_id && <CommunityImage id={post.image_id} alt={post.image_alt} />}
    <p className="mt-5 text-sm text-[#557b39]">{[post.topic,post.location_label].filter(Boolean).join(" · ")}</p>
    {post.published_at && <time className="mt-3 block text-sm" dateTime={post.published_at}>{new Date(post.published_at).toLocaleDateString("en", { dateStyle: "medium", timeZone: "Asia/Seoul" })}</time>}
    {post.type === "discussion" && <p className="mt-3 text-sm font-semibold">Operator-started discussion · Add your own perspective</p>}
    <p className="mt-6 whitespace-pre-wrap break-words leading-8">{post.body}</p>
    {unavailable ? <p className="mt-6">Helpful is temporarily unavailable.</p> : authenticated ? <CommunityInteractions id={id} initialHelpful={helpful} total={total} /> : <div className="mt-6"><p>{total} found this helpful</p><Link className="mt-3 inline-block py-3 underline" href={`/login?next=${encodeURIComponent(`/community/posts/${id}`)}`}>Log in to mark Helpful or report</Link></div>}
    <PostConversation postId={id} />
    <Link href="/community" className="mt-8 inline-block py-3 font-semibold underline">← Back to Community</Link>
  </article></CommunityShell>;
}
