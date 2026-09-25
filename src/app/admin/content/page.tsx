import Link from "next/link";
import { EditorialShell } from "@/components/editorial-content";
import { AdminModerationNav } from "@/components/admin-moderation-nav";
import { requireEditorialAdmin } from "@/lib/editorial-admin";

export default async function AdminContentPage() {
  const client = await requireEditorialAdmin("/admin/content");
  let articles: { id: string; title: string; section: string; category: string; status: string }[] | null = null;
  try {
    const { data, error } = await client.from("editorial_articles").select("id,title,section,category,status")
      .order("updated_at", { ascending: false }).order("id", { ascending: true }).limit(100);
    if (!error) articles = data;
  } catch { /* No private/raw database errors. */ }
  return <EditorialShell title="Editorial content" eyebrow="Administration">
    <AdminModerationNav active="content" />
    <div className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-[#69736c]">Manage up to 100 recently updated stories across K-Contents and K-Trends.</p><Link href="/admin/content/new" className="rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white">Create article →</Link></div>
    {articles === null ? <p role="alert" className="mt-8 rounded-2xl bg-white p-7">Content is unavailable. Confirm the editorial migration has been applied, then refresh.</p>
      : articles.length === 0 ? <p className="mt-8 rounded-2xl bg-white p-7">No articles yet. Create your first draft.</p>
      : <ul className="mt-8 space-y-4">{articles.map(article => <li key={article.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e3e7e2] bg-white p-6"><div><p className="text-xs uppercase tracking-wider text-[#69736c]">{article.section} / {article.category} · {article.status}</p><h2 className="mt-2 break-words text-xl font-semibold">{article.title}</h2></div><div className="flex gap-5 text-sm font-semibold"><Link href={`/admin/content/${article.id}`} className="underline">Edit</Link><Link href={`/admin/content/${article.id}/preview`} className="underline">Preview</Link></div></li>)}</ul>}
  </EditorialShell>;
}
