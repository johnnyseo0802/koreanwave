import Link from "next/link";
import { ContentImage } from "@/components/content-image";
import { listPublicArticles } from "@/lib/editorial-data";
import { trendingConversations } from "@/lib/conversation-data";

export async function HomeEditorial({ lifestyle = false }: { lifestyle?: boolean }) {
  const results = lifestyle
    ? await Promise.all([listPublicArticles("k-trends", "beauty", 3), listPublicArticles("k-trends", "fashion", 3)])
    : await Promise.all([listPublicArticles("k-contents", undefined, 3), listPublicArticles("k-trends", "food", 3), listPublicArticles("local-korea", "guides", 3)]);
  // Editorial recency is not a popularity score. Preserve source classifications.
  const articles = results.every(result => result === null) ? null : results.flatMap(result => result ?? [])
    .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? "") || a.id.localeCompare(b.id)).slice(0, 3);
  return <section className="groov-section"><div className="groov-section-heading"><div><p className="groov-kicker">{lifestyle ? "Style / Self-care / New experiences" : "The editorial edit · Latest published"}</p><h2>{lifestyle ? "Featured Lifestyle" : "Trending Now"}</h2></div><Link className="groov-text-link" href={lifestyle ? "/local-korea/experiences" : "/k-contents"}>{lifestyle ? "Explore experiences ↗" : "Explore K-Contents ↗"}</Link></div>
    {articles === null ? <p className="groov-empty" role="status">Stories couldn’t load. Please try again later.</p> : !articles.length ? <p className="groov-empty">New stories are on the way. Explore Korea in the meantime.</p> : <div className="groov-cards">{articles.map(article => <Link className="groov-card" href={`/articles/${article.id}`} key={article.id}><ContentImage url={article.image_url} alt={article.image_alt} /><p className="groov-kicker mt-5">{article.category}</p><h3 className="mt-2 text-2xl font-semibold tracking-tight">{article.title}</h3><p className="mt-3 line-clamp-3 text-sm leading-6 text-neutral-600">{article.summary}</p><span className="mt-5 inline-block text-sm font-semibold">Read story ↗</span></Link>)}</div>}
    {!lifestyle && <p className="mt-6 text-sm text-neutral-600">Latest editorial stories above. For popular discussions, explore <a className="underline underline-offset-4" href="#community-conversations">Community Conversations</a> below.</p>}
    {lifestyle && <p className="mt-6 text-sm text-neutral-600">Discover beauty and fashion stories, or find your next experience in Local Korea.</p>}
  </section>;
}

export async function HomeConversations() {
  const conversations = await trendingConversations(3);
  return <section id="community-conversations" className="groov-section"><div className="groov-section-heading"><div><p className="groov-kicker">People / Perspectives / Real connections</p><h2>Community Conversations</h2></div><Link className="groov-button groov-community-link" href="/community">Explore conversations ↗</Link></div><p className="mb-7 max-w-2xl text-neutral-600">Popular conversations, ranked by community activity. Original voices, different perspectives, one shared curiosity.</p>
    {conversations === null ? <p className="groov-empty" role="status">Conversations couldn’t load. Please try the Community page later.</p> : !conversations.length ? <p className="groov-empty">No public conversations to show yet. Share a moment or ask a local.</p> : <div className="groov-cards">{conversations.map(({ post, stat }) => <Link key={post.id} href={`/community/posts/${post.id}`} className="groov-conversation"><p className="groov-kicker">{post.type}</p><h3 className="mt-5 text-2xl font-semibold tracking-tight">{post.title ?? "Korea Moment"}</h3><p className="mt-4 line-clamp-3 text-sm leading-6 text-neutral-600">{post.body}</p><p className="mt-8 border-t border-neutral-200 pt-4 text-sm">{stat.comments} comments & replies · {stat.reactions} reactions ↗</p></Link>)}</div>}
    <Link href="/write" className="groov-button groov-button-secondary mt-6 inline-block">Share a story, moment or tip ↗</Link>
  </section>;
}
