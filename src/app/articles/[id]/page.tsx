import { notFound } from "next/navigation";
import { ArticleBody, EditorialShell } from "@/components/editorial-content";
import { getPublicArticle } from "@/lib/editorial-data";
import { sectionLabel, uuidPattern } from "@/lib/editorial";
import { publicMetadata } from "@/lib/public-metadata";
import { RelatedContent } from "@/components/cluster-content";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = uuidPattern.test(id) ? await getPublicArticle(id) : null;
  return article ? publicMetadata(article.title, article.summary, `/articles/${id}`, article.image_url, article.image_alt) : { title: "Page unavailable", robots: { index: false } };
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const article = await getPublicArticle(id);
  // Same response for private/missing records and failed reads; never reveal drafts.
  if (!article) notFound();
  return <EditorialShell title={article.title} eyebrow={`${sectionLabel(article.section)} / ${article.category}`}><ArticleBody article={article} /><RelatedContent target="article_id" id={id}/></EditorialShell>;
}
