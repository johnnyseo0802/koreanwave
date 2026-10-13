import type { MetadataRoute } from "next";
import { publicSitemap } from "@/lib/public-sitemap";

// Recheck current public visibility on every sitemap request, without session
// cookies. Next serves this dynamic metadata route with max-age=0/must-revalidate.
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return publicSitemap();
}
