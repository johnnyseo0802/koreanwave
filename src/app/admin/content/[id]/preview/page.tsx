import Link from "next/link";
import { ArticleBody, EditorialShell } from "@/components/editorial-content";
import { getAdminArticle } from "@/lib/editorial-admin";

export default async function PreviewArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getAdminArticle(id, `/admin/content/${id}/preview`);
  return <EditorialShell title={article.title} eyebrow={`Admin-only saved preview / ${article.section} / ${article.category}`}>
    <div className="mb-8 rounded-2xl bg-[#eef5e7] p-5 text-sm">Status: {article.status}. This preview is only available to administrators. Unsaved edits are not shown. <Link href={`/admin/content/${id}`} className="font-semibold underline">Back to editor</Link></div>
    <ArticleBody article={article} />
  </EditorialShell>;
}
