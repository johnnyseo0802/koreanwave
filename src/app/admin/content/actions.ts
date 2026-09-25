"use server";

import { revalidatePath } from "next/cache";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { uuidPattern, validateEditorial } from "@/lib/editorial";

export async function saveArticle(id: unknown, revision: unknown, form: FormData): Promise<{ ok: boolean; message: string; id?: string; revision?: string }> {
  const access = await getAdminAccess();
  if (access.status !== "admin") return { ok: false, message: "Administrator access could not be verified. Please sign in again." };
  if (id !== null && (typeof id !== "string" || !uuidPattern.test(id))) return { ok: false, message: "Invalid article. Return to the content list." };
  if (id !== null && (typeof revision !== "string" || revision.length > 64 || !Number.isFinite(Date.parse(revision)))) return { ok: false, message: "Reload the article before saving." };
  if (!(form instanceof FormData)) return { ok: false, message: "Invalid form. Please reload the editor." };
  const validated = validateEditorial(form);
  if (!validated.value) return { ok: false, message: validated.error ?? "Check the article fields." };
  // Explicit whitelist from validation. Never accept identity, timestamps, table names,
  // role claims or extra form fields. RLS independently rechecks the current admin.
  const { section, category, title, summary, body, image_url, source_url, status } = validated.value;
  const payload = { section, category, title, summary, body, image_url, source_url, status };
  try {
    const query = id === null
      ? access.client.from("editorial_articles").insert(payload)
      : access.client.from("editorial_articles").update(payload).eq("id", id).eq("updated_at", revision);
    const { data, error } = await query.select("id,updated_at").maybeSingle();
    if (error) return { ok: false, message: "We couldn’t save this article. Check your access and try again. If this is a new article, check the list before retrying." };
    if (!data) return { ok: false, message: "This article changed or is no longer available. Reload it before saving again." };
    revalidatePath("/admin/content");
    revalidatePath(`/admin/content/${data.id}`);
    revalidatePath(`/admin/content/${data.id}/preview`);
    revalidatePath(`/articles/${data.id}`);
    // Both old and new categories are covered when moving an article.
    revalidatePath("/k-contents", "layout");
    revalidatePath("/k-trends", "layout");
    return { ok: true, id: data.id, revision: data.updated_at, message: status === "published" ? "Article published. Saved changes are now public." : "Draft saved. This article is not publicly available." };
  } catch {
    return { ok: false, message: "We couldn’t confirm the save. Check the content list before retrying to avoid a duplicate." };
  }
}
