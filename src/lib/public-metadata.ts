import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { safeMediaUrl } from "@/lib/media";
import { siteOrigin } from "@/lib/site-origin";
export { siteOrigin } from "@/lib/site-origin";
export function publicPageMetadata(title: string, path: string, description: string = brand.description): Metadata {
  return publicMetadata(title, description, path);
}
export function publicMetadata(title: string, description: string, path: string, image?: string | null, alt?: string | null): Metadata {
  const safe = safeMediaUrl(image);
  return { title, description: description.slice(0, 160), alternates: { canonical: `${siteOrigin}${path}` },
    openGraph: { title, description: description.slice(0, 160), url: `${siteOrigin}${path}`, siteName: brand.name, type: "website", images: safe ? [{ url: safe, alt: alt ?? title }] : [{ url: `${siteOrigin}/opengraph-image` }] },
    twitter: { card: "summary_large_image", title, description: description.slice(0, 160), images: [safe ?? `${siteOrigin}/opengraph-image`] },
  };
}
