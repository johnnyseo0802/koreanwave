import type { Metadata } from "next";
import { safeMediaUrl } from "@/lib/media";
export const siteOrigin = "https://koreanwave-kappa.vercel.app";
export function publicMetadata(title: string, description: string, path: string, image?: string | null, alt?: string | null): Metadata {
  const safe = safeMediaUrl(image);
  return { title, description: description.slice(0, 160), alternates: { canonical: `${siteOrigin}${path}` },
    openGraph: { title, description: description.slice(0, 160), url: `${siteOrigin}${path}`, siteName: "Korean Wave Community", type: "website", images: safe ? [{ url: safe, alt: alt ?? title }] : [{ url: `${siteOrigin}/opengraph-image` }] },
    twitter: { card: "summary_large_image", title, description: description.slice(0, 160), images: [safe ?? `${siteOrigin}/opengraph-image`] },
  };
}
