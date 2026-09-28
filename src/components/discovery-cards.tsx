import Link from "next/link";
import { ContentImage } from "@/components/content-image";
import type { DiscoveryCard } from "@/lib/discovery";

export function DiscoveryCards({ cards, images = true }: { cards: DiscoveryCard[]; images?: boolean }) {
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{cards.map(card => <Link href={card.href} key={card.href} className="group min-w-0 rounded-2xl border border-[#e3e7e2] bg-white p-3 transition hover:border-[#78946b]">
    {images && <ContentImage url={card.image_url} alt={card.image_alt} />}
    <div className="px-2 py-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#557b39]">{card.label}</p><h2 className="mt-2 break-words text-xl font-semibold">{card.title}</h2><p className="mt-3 line-clamp-3 break-words text-sm leading-6 text-[#69736c]">{card.summary}</p><span className="mt-4 block text-sm font-semibold text-[#557b39]">Explore →</span></div>
  </Link>)}</div>;
}
