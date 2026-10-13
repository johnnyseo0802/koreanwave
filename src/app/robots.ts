import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site-origin";

export default function robots(): MetadataRoute.Robots {
  // Let crawlers read existing noindex directives. Robots is not access control.
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${siteOrigin}/sitemap.xml` };
}
