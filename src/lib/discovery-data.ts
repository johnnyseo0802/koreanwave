import "server-only";
import { createClient } from "@/lib/supabase/server";
import { searchTerm, type DiscoveryCard } from "@/lib/discovery";
import { uuidPattern } from "@/lib/editorial";

export type LocalKind = "places" | "experiences";
export type LocalItem = { id: string; name: string; description: string; area: string; category: string; visitor_info?: string | null; image_url: string | null; image_alt: string | null };
export const localFields = "id,name,description,area,category,visitor_info,image_url,image_alt";
export async function getLocalItem(kind: LocalKind, id: string): Promise<LocalItem | null> {
  if (!uuidPattern.test(id)) return null;
  try {
    const client = await createClient();
    const { data, error } = await client.from(kind).select(localFields).eq("id", id).eq("status", "published").maybeSingle();
    return error ? null : data;
  } catch { return null; }
}
export async function searchPublicContent(input: string): Promise<{ cards: DiscoveryCard[]; unavailable: boolean }> {
  const term = searchTerm(input);
  if (!term) return { cards: [], unavailable: false };
  const groups = await Promise.all([
    searchGroup("editorial_articles", term), searchGroup("places", term), searchGroup("experiences", term), searchGroup("content_clusters", term),
  ]);
  return { cards: groups.flatMap(g => g ?? []), unavailable: groups.some(g => g === null) };
}
async function searchGroup(kind: "editorial_articles" | "content_clusters" | LocalKind, term: string): Promise<DiscoveryCard[] | null> {
  try {
    const client = await createClient();
    if (kind === "content_clusters") {
      const { data, error } = await client.from("content_clusters").select("id,slug,title,summary").eq("status", "published")
        .or(`title.ilike.%${term}%,summary.ilike.%${term}%`).order("display_order").order("id").limit(20);
      return error ? null : (data ?? []).map(c=>({...c,href:`/explore/${c.slug}`,label:"Explore / topic"}));
    }
    // Table/fields from constants only; sanitized literal value cannot alter filter grammar.
    if (kind === "editorial_articles") {
      const { data, error } = await client.from("editorial_articles").select("id,section,category,title,summary,image_url,image_alt")
        .eq("status", "published").or(`title.ilike.%${term}%,summary.ilike.%${term}%,category.ilike.%${term}%`)
        .order("published_at", { ascending: false }).limit(20);
      return error ? null : (data ?? []).map(a => ({ ...a, href: `/articles/${a.id}`, label: `${a.section} / ${a.category}` }));
    }
    const { data, error } = await client.from(kind).select("id,name,description,area,category,image_url,image_alt")
      .eq("status", "published").or(`name.ilike.%${term}%,description.ilike.%${term}%,area.ilike.%${term}%,category.ilike.%${term}%`)
      .order("published_at", { ascending: false }).limit(20);
    return error ? null : (data ?? []).map(a => ({ ...a, title: a.name, summary: a.description, href: `/local-korea/${kind}/${a.id}`, label: `${kind} / ${a.area} · ${a.category}` }));
  } catch { return null; }
}
