import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { CommunityShell } from "@/components/community-shell";
import { AdminModerationNav } from "@/components/admin-moderation-nav";
import { ArticleDiscussionEditor, ConversationModeration, DiscussionEditor } from "@/components/conversation-admin";
export const metadata = { title: "Conversation moderation", robots: { index: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const access = await getAdminAccess();
  if (access.status === "unauthenticated") redirect("/login?next=/admin/conversations");
  if (access.status !== "admin") notFound();
  const { tab: requested } = await searchParams;
  const tabs = ["reports", "approved", "pending", "rejected", "discussions"];
  const tab = requested && tabs.includes(requested) ? requested : "reports";
  const client = access.client;
  async function load() {
    if (tab === "discussions") {
      const [articles, posts, links] = await Promise.all([
        client.from("editorial_articles").select("id,title").order("updated_at", { ascending: false }).limit(100),
        client.from("community_posts").select("id,title").eq("type", "discussion").eq("status", "approved").order("published_at", { ascending: false }).limit(100),
        client.from("article_discussions").select("article_id,post_id").limit(1000),
      ]);
      if (articles.error || posts.error || links.error) throw new Error("Unavailable");
      return <><DiscussionEditor /><ArticleDiscussionEditor articles={articles.data ?? []} posts={posts.data ?? []} links={links.data ?? []} /><Link href="/admin/community" className="mt-5 inline-block py-3 underline">Review pending discussion posts →</Link></>;
    } else if (tab === "reports") {
      const reports = await client.from("community_reports").select("id,post_id,comment_id,reason,details").eq("status", "open").order("created_at").limit(50);
      if (reports.error) throw new Error("Unavailable");
      const cards = await Promise.all((reports.data ?? []).map(async r => {
        const post = await client.from("community_posts").select("id,title,body,status").eq("id", r.post_id).maybeSingle();
        const comment = r.comment_id ? await client.from("community_comments").select("id,parent_comment_id,body,status").eq("id", r.comment_id).eq("post_id", r.post_id).maybeSingle() : null;
        const parent = comment?.data?.parent_comment_id ? await client.from("community_comments").select("body,status").eq("id", comment.data.parent_comment_id).eq("post_id", r.post_id).maybeSingle() : null;
        return <article key={r.id} className="rounded-xl border bg-white p-5"><h2 className="font-semibold">{r.reason.replaceAll("_", " ")}</h2><p className="mt-3 whitespace-pre-wrap break-words">{r.details}</p><h3 className="mt-5 font-semibold">{post.data?.title ?? "Unavailable post"}</h3><p className="whitespace-pre-wrap break-words">{post.data?.body}</p>{post.data?.status === "approved" && <ConversationModeration id={post.data.id} status="approved" kind="post" />}{parent?.data && <blockquote className="my-3 border-l-2 pl-3 whitespace-pre-wrap break-words">Parent ({parent.data.status}): {parent.data.body}</blockquote>}{comment?.data && <div className="mt-4 rounded-xl bg-[#f6f8f3] p-4"><p className="whitespace-pre-wrap break-words">{comment.data.body}</p><ConversationModeration id={comment.data.id} status={comment.data.status} kind="comment" /></div>}<ConversationModeration id={r.id} status="open" kind="report" /></article>;
      }));
      return cards.length ? cards : <p>No open reports.</p>;
    } else {
      const r = await client.from("community_comments").select("id,post_id,parent_comment_id,body,status,created_at").eq("status", tab).order("created_at").order("id").limit(50);
      if (r.error) throw new Error("Unavailable");
      const cards = await Promise.all((r.data ?? []).map(async c => {
        const post = await client.from("community_posts").select("title,body,status").eq("id", c.post_id).maybeSingle();
        const parent = c.parent_comment_id ? await client.from("community_comments").select("body,status").eq("id", c.parent_comment_id).eq("post_id", c.post_id).maybeSingle() : null;
        return <article key={c.id} className="rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">{post.data?.title ?? "Conversation"}</h2><p className="mt-3 whitespace-pre-wrap break-words">{post.data?.body}</p><p className="mt-2 text-sm">Post: {post.data?.status ?? "unavailable"} · Comment: {c.status}</p>{parent?.data && <blockquote className="my-3 border-l-2 pl-3 whitespace-pre-wrap break-words">Parent ({parent.data.status}): {parent.data.body}</blockquote>}<p className="mt-4 whitespace-pre-wrap break-words">{c.body}</p><ConversationModeration id={c.id} status={c.status} kind="comment" /></article>;
      }));
      return cards.length ? cards : <p>No comments in this queue.</p>;
    }
  }
  // Catch query failures only; rendering failures belong to Next's error boundary.
  const contents = await load().catch(() => null);
  return <CommunityShell title="Conversation moderation" description="Allow disagreement about ideas. Review harassment, threats, hate, sexual harassment and spam. Identity stays private."><AdminModerationNav active="conversations" /><nav aria-label="Conversation queues" className="mb-6 flex flex-wrap gap-3">{tabs.map(t => <Link key={t} aria-current={tab === t ? "page" : undefined} href={`/admin/conversations?tab=${t}`} className="rounded-full border px-5 py-3 capitalize">{t}</Link>)}</nav><div className="space-y-5 break-words [overflow-wrap:anywhere]">{contents ?? <p role="alert">Conversation tools are unavailable. Check the reviewed migration and refresh.</p>}</div><p className="mt-5 text-sm">Queues show up to 50 items. Hiding/rejection is terminal. Reviewing a report does not itself hide content.</p></CommunityShell>;
}
