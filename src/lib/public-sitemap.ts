import "server-only";
import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerConfig } from "@/lib/supabase/config";
import { siteOrigin } from "@/lib/site-origin";
import { uuidPattern } from "@/lib/editorial";
import { slugPattern } from "@/lib/clusters";

export const staticPublicPaths = [
  "/", "/k-contents", "/k-contents/music", "/k-contents/dramas", "/k-contents/movies",
  "/k-trends", "/k-trends/beauty", "/k-trends/fashion", "/k-trends/food",
  "/local-korea", "/local-korea/guides", "/local-korea/places", "/local-korea/experiences",
  "/community", "/community/questions", "/community/reviews", "/events", "/explore",
  "/about", "/contact", "/faq", "/safety", "/terms", "/privacy", "/cancellation", "/founding-members",
] as const;

const sources = [
  { table: "editorial_articles", status: "published", path: "/articles" },
  { table: "places", status: "published", path: "/local-korea/places" },
  { table: "experiences", status: "published", path: "/local-korea/experiences" },
  { table: "events", status: "published", path: "/event" },
  { table: "questions", status: "approved", path: "/community/questions" },
  { table: "community_posts", status: "approved", path: "/community/posts" },
  { table: "content_clusters", status: "published", path: "/explore" },
] as const;
const unavailable = () => new Error("Public sitemap temporarily unavailable.");

export async function publicSitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const { url, publishableKey } = getSupabaseServerConfig();
    // Anonymous, cookie-independent reads, even when a signed-in admin requests
    // the sitemap. Never share an SSR/session client or use a privileged key.
    const client = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, {
        ...init, cache: "no-store", signal: AbortSignal.timeout(10000),
      }) },
    });
    const groups = await Promise.all(sources.map(async (source) => {
      const links: MetadataRoute.Sitemap = [];
      let after: string | null = null;
      const slugRoute = source.table === "content_clusters";
      // Keyset paging avoids the API's default row cap and changing offsets.
      // Do not silently publish a truncated sitemap: shard before 50,000 URLs.
      for (let page = 0; page < 100; page++) {
        let query = client.from(source.table).select(slugRoute ? "id,slug,status" : "id,status")
          .eq("status", source.status).order("id", { ascending: true }).limit(500);
        if (after) query = query.gt("id", after);
        const { data, error } = await query;
        if (error || !Array.isArray(data)) throw unavailable();
        if (data.length === 0) return links;
        for (const item of data) {
          const row = item as unknown as { id?: unknown; slug?: unknown; status?: unknown };
          // Defense in depth, not a substitute for RLS or the explicit filter.
          if (typeof row.id !== "string" || !uuidPattern.test(row.id)
            || (after !== null && row.id <= after) || row.status !== source.status) throw unavailable();
          const segment = slugRoute ? row.slug : row.id;
          if (typeof segment !== "string" || (slugRoute && (segment.length < 2 || segment.length > 80 || !slugPattern.test(segment)))) throw unavailable();
          links.push({ url: `${siteOrigin}${source.path}/${segment}` });
          after = row.id;
        }
      }
      throw unavailable();
    }));
    const entries = [...staticPublicPaths.map(path => ({ url: `${siteOrigin}${path}` })), ...groups.flat()];
    if (entries.length > 50000) throw unavailable();
    return entries;
  } catch {
    // Do not serve/cache a misleading empty sitemap after a read failure, or
    // log raw provider errors, URLs, credentials or private content.
    throw unavailable();
  }
}
