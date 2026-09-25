import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { editorialCategories, safeEditorialUrl, sectionLabel, type EditorialSection, type PublicArticle } from "@/lib/editorial";
import { listPublicArticles } from "@/lib/editorial-data";

export function EditorialShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return <main className="min-h-screen bg-[#fcfcfa] text-[#18201d]"><SiteHeader />
    <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#557b39]">{eyebrow}</p>
      <h1 className="mt-4 break-words text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">{title}</h1>
      <div className="mt-8">{children}</div>
    </section><SiteFooter /></main>;
}

export function EditorialImage({ url, title }: { url: string | null; title: string }) {
  const safe = safeEditorialUrl(url);
  if (!safe) return <div aria-hidden="true" className="aspect-[16/9] rounded-2xl bg-gradient-to-br from-[#dceee4] via-[#dce8ff] to-[#eadffd]" />;
  // Direct browser request avoids exposing an arbitrary-URL server image fetcher.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={safe} alt={title} loading="lazy" referrerPolicy="no-referrer" className="aspect-[16/9] w-full rounded-2xl bg-[#f4f7f0] object-cover" />;
}

export function PublicationDate({ value }: { value: string | null }) {
  if (!value) return null;
  return <time dateTime={value}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(value))}</time>;
}

export function ArticleBody({ article }: { article: PublicArticle }) {
  const source = safeEditorialUrl(article.source_url);
  return <article className="max-w-4xl">
    <p className="text-sm text-[#69736c]"><PublicationDate value={article.published_at} /></p>
    <p className="mt-5 whitespace-pre-wrap break-words text-xl leading-8 text-[#56625a]">{article.summary}</p>
    {safeEditorialUrl(article.image_url) && <div className="mt-8"><EditorialImage url={article.image_url} title={article.title} /></div>}
    <div className="mt-8 whitespace-pre-wrap break-words rounded-[2rem] border border-[#e3e7e2] bg-white p-7 text-base leading-8 sm:p-10">{article.body}</div>
    {source && <p className="mt-6 text-sm"><a href={source} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="underline">Source / attribution ↗</a></p>}
    <Link href={`/${article.section}/${article.category}`} className="mt-8 inline-block rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white">← Back to {article.category}</Link>
  </article>;
}

export async function EditorialListing({ section, category }: { section: EditorialSection; category?: string }) {
  const categories = editorialCategories[section];
  const title = category ? Object.entries(categories).find(([key]) => key === category)?.[1] ?? sectionLabel(section) : sectionLabel(section);
  const articles = await listPublicArticles(section, category);
  return <EditorialShell title={title} eyebrow={section === "k-contents" ? "Culture, curated / K-Contents" : "Now in Korea / K-Trends"}>
    <p className="max-w-2xl leading-7 text-[#69736c]">{section === "k-contents" ? "Explore the sounds, stories, and screen moments that lead people toward Korea." : "Discover Korean beauty, fashion, and food through our editorial stories."}</p>
    <nav aria-label="Article categories" className="my-8 flex flex-wrap gap-3 border-b border-[#e4e8e1] pb-7">
      {[["", "All"], ...Object.entries(categories)].map(([key, label]) => <Link key={key} href={`/${section}${key ? `/${key}` : ""}`} aria-current={(category ?? "") === key ? "page" : undefined} className={`rounded-full px-5 py-2 text-sm font-semibold ${(category ?? "") === key ? "bg-[#17201d] text-white" : "border border-[#dce2dc] bg-white text-[#56625a]"}`}>{label}</Link>)}
    </nav>
    {articles === null ? <p role="alert" className="rounded-2xl border border-[#e3e7e2] bg-white p-7">We couldn’t load these stories. Please try again later.</p>
      : articles.length === 0 ? <p className="rounded-2xl border border-[#e3e7e2] bg-white p-7">No stories have been published yet. Check back for our next discoveries.</p>
      : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{articles.map(article => <Link href={`/articles/${article.id}`} key={article.id} className="rounded-2xl border border-[#e3e7e2] bg-white p-3 transition hover:shadow-lg">
        <EditorialImage url={article.image_url} title={article.title} />
        <div className="px-2 py-4"><p className="text-xs font-semibold uppercase tracking-wider text-[#557b39]">{article.category}</p><h2 className="mt-2 break-words text-xl font-semibold">{article.title}</h2><p className="mt-3 line-clamp-3 break-words text-sm leading-6 text-[#69736c]">{article.summary}</p><p className="mt-4 text-xs text-[#69736c]"><PublicationDate value={article.published_at} /></p></div>
      </Link>)}</div>}
  </EditorialShell>;
}
