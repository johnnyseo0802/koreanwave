import "server-only";
import { createClient } from "@/lib/supabase/server";
import { clusterFields, slugPattern, targets, type Target, type Cluster, type Prompt } from "@/lib/clusters";
import { uuidPattern } from "@/lib/editorial";
import type { DiscoveryCard } from "@/lib/discovery";

export async function publicClusters(limit = 40): Promise<Cluster[] | null> {
  try { const client = await createClient(); const r = await client.from("content_clusters").select(clusterFields).eq("status", "published").order("display_order").order("id").limit(limit); return r.error ? null : r.data as Cluster[]; } catch { return null; }
}
export async function publicCluster(slug: string): Promise<Cluster | null> {
  if (slug.length > 80 || !slugPattern.test(slug)) return null;
  try { const client = await createClient(); const r = await client.from("content_clusters").select(clusterFields).eq("slug",slug).eq("status", "published").maybeSingle(); return r.error ? null : r.data as Cluster | null; } catch { return null; }
}
type Linked = { display_order: number; target: { id: string; title?: string | null; name?: string; summary?: string; description?: string; body?: string; image_url?: string | null; image_alt?: string | null } };
export type ClusterGroup = { key: Target; label: string; cards: DiscoveryCard[] };
// Shared with authorized admin preview. Targets ALWAYS use public status filters.
// No raw relationship rows/private IDs are returned to Client Components.
export async function clusterContents(id: string, preview = false): Promise<{ groups: ClusterGroup[]; prompts: Prompt[]; unavailable: boolean }> {
  if (!uuidPattern.test(id)) return { groups: [], prompts: [], unavailable: true };
  try {
    const client = await createClient();
    // Preview is not a bypass: recheck admin even if called outside its page.
    if (preview) { const { getAdminAccess } = await import("@/lib/auth/admin-access"); if ((await getAdminAccess()).status !== "admin") return { groups: [], prompts: [], unavailable: true }; }
    else { const c = await client.from("content_clusters").select("id").eq("id",id).eq("status", "published").maybeSingle(); if(c.error || !c.data) return { groups: [], prompts: [], unavailable: true }; }
    const results = await Promise.all(Object.entries(targets).map(async ([key, config]) => {
      const r = await client.from("content_cluster_items").select(`display_order,target:${config.table}!inner(${config.fields})`).eq("cluster_id",id).eq("target.status",config.status).order("display_order").order("id").limit(24);
      const rows = (r.error ? [] : r.data ?? []) as unknown as Linked[];
      return { error: !!r.error, key: key as Target, label: config.label, cards: rows.map(({target:t}) => ({ id:t.id,title:t.title ?? t.name ?? "Korea Moment",summary:t.summary ?? t.description ?? t.body ?? "",href:`${config.base}/${t.id}`,label:config.label,image_url:t.image_url,image_alt:t.image_alt })) };
    }));
    const prompts = await client.from("content_cluster_prompts").select("id,kind,prompt,display_order").eq("cluster_id",id).order("display_order").order("id").limit(20);
    return { groups:results.map(({key,label,cards})=>({key,label,cards})),prompts:prompts.error?[]:prompts.data??[],unavailable:results.some(r=>r.error)||!!prompts.error };
  } catch { return { groups:[],prompts:[],unavailable:true }; }
}
export async function relatedContent(target: Target, id: string) {
  if (!uuidPattern.test(id)) return [];
  try {
    const client = await createClient();
    const config=targets[target];
    const source=await client.from(config.table).select("id").eq("id",id).eq("status",config.status).maybeSingle();
    if(source.error||!source.data)return [];
    const links=await client.from("content_cluster_items").select("cluster:content_clusters!inner(id,slug,title)").eq(target,id).eq("cluster.status", "published").order("display_order").limit(3);
    if(links.error)return [];
    const entries=links.data as unknown as {cluster:{id:string;slug:string;title:string}}[];
    return await Promise.all(entries.map(async ({cluster})=>({slug:cluster.slug,title:cluster.title,cards:(await clusterContents(cluster.id)).groups.flatMap(g=>g.cards).filter(c=>c.href!==`${config.base}/${id}`).slice(0,4)})));
  } catch { return []; }
}
