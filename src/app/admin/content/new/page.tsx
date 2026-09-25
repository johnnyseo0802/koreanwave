import Link from "next/link";
import { EditorialShell } from "@/components/editorial-content";
import { EditorialForm } from "@/components/editorial-form";
import { AdminModerationNav } from "@/components/admin-moderation-nav";
import { requireEditorialAdmin } from "@/lib/editorial-admin";

export default async function NewArticlePage() {
  await requireEditorialAdmin("/admin/content/new");
  return <EditorialShell title="Create article" eyebrow="Editorial / New draft"><AdminModerationNav active="content" /><Link href="/admin/content" className="text-sm underline">← Content list</Link><EditorialForm /></EditorialShell>;
}
