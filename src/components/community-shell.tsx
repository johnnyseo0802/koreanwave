import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import type { FeedCard } from "@/lib/community-data";
export const communityButton = "inline-block rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50";
export const communityInput = "mt-2 block w-full rounded-xl border border-[#ccd2cb] bg-white p-3";
export function CommunityShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <main className="min-h-screen bg-[#fcfcfa] text-[#18201d]"><SiteHeader /><section className="mx-auto max-w-7xl px-5 py-14 sm:px-8"><p className="text-xs font-semibold uppercase tracking-widest text-[#557b39]">Your community</p><h1 className="mt-4 break-words text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>{description && <p className="mt-4 max-w-2xl leading-7 text-[#69736c]">{description}</p>}<div className="mt-8">{children}</div></section><SiteFooter /></main>;
}
export function CommunityImage({ id, alt }: { id: string; alt: string | null }) {
  // Already resized/re-encoded on server. Bypass Next image cache for private media.
  return <Image unoptimized src={`/community/media/${id}`} alt={alt || "Community member’s Korea photo"} width={1200} height={900} className="max-h-[36rem] w-full rounded-2xl object-contain" />;
}
export function CommunityCards({ cards }: { cards: FeedCard[] }) {
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{cards.map(card => <article key={`${card.type}-${card.id}`} className="min-w-0 rounded-2xl border border-[#e3e7e2] bg-white p-5">
    {card.image_id && <Link href={card.href}><CommunityImage id={card.image_id} alt={card.image_alt ?? null} /></Link>}
    <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[#557b39]">{card.type}{card.is_featured ? " · Featured" : ""}</p><h2 className="mt-3 break-words text-xl font-semibold"><Link href={card.href}>{card.title} →</Link></h2><p className="mt-3 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-6 text-[#626c66]">{card.body}</p>{card.published_at && <time dateTime={card.published_at} className="mt-4 block text-xs text-[#626c66]">{new Date(card.published_at).toLocaleDateString("en", { timeZone: "Asia/Seoul", dateStyle: "medium" })}</time>}
  </article>)}</div>;
}
