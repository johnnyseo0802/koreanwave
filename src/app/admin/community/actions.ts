"use server";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { uuid, postTypes, count, type PostType, type ActionResult } from "@/lib/community";
import { revalidatePath } from "next/cache";
const failure = { ok: false, message: "We couldn’t save this change. Refresh and verify administrator access." };
export async function moderateCommunity(id: string, decision: string): Promise<ActionResult> {
  if (!uuid.test(id) || !["approved","rejected","feature","unfeature"].includes(decision)) return failure;
  const access = await getAdminAccess(); if (access.status !== "admin") return failure;
  try {
    const feature = decision === "feature" || decision === "unfeature";
    let query = access.client.from("community_posts").update(feature ? { is_featured: decision === "feature" } : { status: decision }).eq("id",id).eq("status",feature ? "approved" : "pending");
    if (feature) query = query.eq("is_featured",decision !== "feature");
    const { data, error } = await query.select("id").maybeSingle();
    if (error || !data) return { ok: false, message: "This item changed or is unavailable. Refresh the queue." };
    for (const path of ["/admin/community","/community","/","/account/contributions",`/community/posts/${id}`]) revalidatePath(path);
    return { ok: true, message: feature ? "Featured status updated." : "Moderation decision saved." };
  } catch { return failure; }
}
export async function resolveCommunityReport(id: string): Promise<ActionResult> {
  if (!uuid.test(id)) return failure;
  const access = await getAdminAccess(); if (access.status !== "admin") return failure;
  try {
    const { data,error } = await access.client.from("community_reports").update({ status: "resolved" }).eq("id",id).eq("status","open").select("id").maybeSingle();
    if (error || !data) return failure;
    revalidatePath("/admin/community"); return { ok: true, message: "Report marked reviewed. No content was removed." };
  } catch { return failure; }
}
export async function saveWeeklyPrompt(form: FormData): Promise<ActionResult> {
  const prompt = form.get("prompt"), type = form.get("suggested_type");
  if (typeof prompt !== "string" || count(prompt)<5 || count(prompt)>240 || typeof type !== "string" || !postTypes.includes(type as PostType)) return { ok: false, message: "Enter a prompt of 5–240 characters and choose a post type." };
  const access = await getAdminAccess(); if (access.status !== "admin") return failure;
  try {
    const current = await access.client.from("community_prompt").select("id").eq("id",true).maybeSingle();
    if (current.error) return failure;
    const values = { prompt: prompt.trim(), suggested_type: type };
    const result = current.data ? await access.client.from("community_prompt").update(values).eq("id",true).select("id").maybeSingle() : await access.client.from("community_prompt").insert(values).select("id").single();
    if (result.error || !result.data) return failure;
    revalidatePath("/community"); revalidatePath("/admin/community");
    return { ok: true, message: "Weekly prompt saved." };
  } catch { return failure; }
}
