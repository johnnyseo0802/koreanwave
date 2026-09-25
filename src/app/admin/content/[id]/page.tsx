import Link from "next/link";
import { EditorialShell } from "@/components/editorial-content";
import { EditorialForm } from "@/components/editorial-form";
import { AdminModerationNav } from "@/components/admin-moderation-nav";
import { getAdminArticle } from "@/lib/editorial-admin";

export default async function EditArticlePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const article = await getAdminArticle(id, `/admin/content/${id}`);
  const saved = (await searchParams).saved;
  return <EditorialShell title="Edit article" eyebrow={`Editorial / ${article.status}`}><AdminModerationNav active="content" /><Link href="/admin/content" className="text-sm underline">← Content list</Link>
    {(saved === "draft" || saved === "published") && <p role="status" className="mt-5 rounded-xl bg-[#eef5e7] p-4 text-sm">Article created. Current status: {article.status}.</p>}
    <EditorialForm key={article.id} article={article} /></EditorialShell>;
}
