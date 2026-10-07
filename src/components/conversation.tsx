import Link from "next/link";
import { articleConversation, conversationData, trendingConversations } from "@/lib/conversation-data";
import { CommentComposer, CommentReport, ReactionButtons } from "@/components/conversation-controls";
import type { Comment } from "@/lib/conversation";
import { TranslatableContent } from "@/components/translatable-content";
export async function PostConversation({ postId }: { postId: string }) {
  const data = await conversationData(postId);
  const login = `/login?next=${encodeURIComponent(`/community/posts/${postId}`)}`;
  const roots = data.comments.filter(c => !c.parent_comment_id);
  const render = (c: Comment) => <div className="min-w-0 break-words [overflow-wrap:anywhere]"><p className="text-sm font-semibold">{data.own.some(o => o.id === c.id) ? "You" : "Community member"}</p><time className="text-xs text-[#69736c]" dateTime={c.created_at}>{new Date(c.created_at).toLocaleDateString("en", { timeZone: "Asia/Seoul" })}</time><TranslatableContent contentType="comment" contentId={c.id} originalText={c.body} authenticated={data.authenticated} postId={postId} />{data.authenticated && <CommentReport postId={postId} id={c.id} />}</div>;
  return <section aria-label="Conversation" className="mt-10 border-t pt-8"><h2 className="text-2xl font-semibold">Join the conversation</h2><p className="mt-3 text-sm">Strong opinions welcome. Personal attacks, threats, hate, sexual harassment and spam are not.</p>
    {data.unavailable ? <p role="status" className="mt-4">Conversation features are temporarily unavailable. Please try again later.</p> : <>
      {data.authenticated ? <><ReactionButtons postId={postId} mine={data.mine} counts={data.counts} /><CommentComposer postId={postId} /></> : <><p className="mt-4 text-sm">Like {data.counts.like ?? 0} · Interesting {data.counts.interesting ?? 0} · Agree {data.counts.agree ?? 0}</p><Link className="my-4 inline-block rounded-full border px-5 py-3 underline" href={login}>Log in to add your take or react</Link></>}
      {!roots.length && <p className="my-6">Be the first to share your take.</p>}
      <ol className="mt-5 space-y-6">{roots.map(root => <li key={root.id} className="rounded-xl border p-4 sm:p-5">{render(root)}{data.authenticated && <details className="mt-2"><summary className="cursor-pointer py-3 font-semibold underline">Reply</summary><CommentComposer postId={postId} parent={root.id} /></details>}<ol className="mt-4 space-y-4 border-l-2 pl-3 sm:pl-5">{data.comments.filter(c => c.parent_comment_id === root.id).map(reply => <li key={reply.id} className="rounded-lg bg-[#f6f8f3] p-3">{render(reply)}</li>)}</ol></li>)}</ol>
      <p className="mt-5 text-xs">Showing the latest 30 comments and up to 100 recent replies, in chronological order. Replies are one level deep.</p>
      {!!data.own.filter(c => c.status !== "approved").length && <aside className="mt-6 rounded-xl bg-[#edf3e5] p-4"><h3 className="font-semibold">Your contribution status</h3>{data.own.filter(c => c.status !== "approved").map(c => <div key={c.id} className="mt-3"><p className="text-sm capitalize">{c.status}</p><p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{c.body}</p></div>)}</aside>}
    </>}
  </section>;
}
export async function ArticleConversation({ articleId }: { articleId: string }) {
  const post = await articleConversation(articleId);
  return <section className="mt-10 rounded-2xl bg-[#edf3e5] p-6"><h2 className="text-2xl font-semibold">Join the conversation</h2>{post ? <><p className="mt-3 break-words">{post.title}</p><Link className="mt-4 inline-block py-3 font-semibold underline" href={`/community/posts/${post.id}`}>Add your take →</Link></> : <><p className="mt-3">What do you think? Find a conversation or share your own experience.</p><Link className="mt-4 inline-block py-3 font-semibold underline" href="/community">Explore community conversations →</Link></>}</section>;
}
export async function TrendingConversations({ home = false }: { home?: boolean }) {
  const rows = await trendingConversations(home ? 4 : 30);
  return <section className={home ? "mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10" : "my-8"} aria-label="Trending conversations"><h2 className="text-3xl font-semibold">{home ? "What’s happening" : "Trending conversations"}</h2><p className="mt-3">Conversations about Korea. Add your perspective.</p>
    {rows === null ? <p role="status" className="mt-5">Conversations are temporarily unavailable.</p> : !rows.length ? <p className="mt-5">No published conversations yet. Your real experiences can start the next one.</p> : <div className="mt-6 grid gap-4 sm:grid-cols-2">{rows.map(({ post, stat }) => <article key={post.id} className="min-w-0 rounded-2xl border bg-white p-6"><p className="text-xs uppercase">{post.type}</p><h3 className="mt-3 break-words text-xl font-semibold"><Link href={`/community/posts/${post.id}`}>{post.title ?? "Korea Moment"} →</Link></h3><p className="mt-4 text-sm">{stat.comments} comments & replies · {stat.reactions} reactions</p><p className="mt-2 text-xs">Latest publication activity: <time dateTime={stat.last_activity}>{new Date(stat.last_activity).toLocaleDateString("en", { timeZone: "Asia/Seoul" })}</time></p></article>)}</div>}
    <Link href={home ? "/community?type=trending" : "/write"} className="mt-5 inline-block py-3 font-semibold underline">{home ? "Join the conversation" : "Share your experience"} →</Link>
  </section>;
}
