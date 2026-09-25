import "server-only";
import { notFound, redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { adminArticleFields, uuidPattern, type AdminArticle } from "@/lib/editorial";

export async function requireEditorialAdmin(path: string) {
  const access = await getAdminAccess();
  if (access.status === "unauthenticated") redirect(`/login?next=${encodeURIComponent(path)}`);
  if (access.status !== "admin") notFound();
  return access.client;
}

export async function getAdminArticle(id: string, path: string) {
  const client = await requireEditorialAdmin(path);
  if (!uuidPattern.test(id)) notFound();
  let article: AdminArticle | null = null;
  try {
    const { data, error } = await client.from("editorial_articles").select(adminArticleFields).eq("id", id).maybeSingle();
    if (!error) article = data as AdminArticle | null;
  } catch { /* Safe, closed failure without database or session logging. */ }
  if (!article) notFound();
  return article;
}
