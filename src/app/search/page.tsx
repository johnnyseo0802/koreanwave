import { EditorialShell } from "@/components/editorial-content";
import { DiscoveryCards } from "@/components/discovery-cards";
import { searchPublicContent } from "@/lib/discovery-data";
import { searchTerm } from "@/lib/discovery";
export const metadata = { title: "Search Korea", robots: { index: false, follow: true } };
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const q = searchTerm((await searchParams).q);
  const { cards, unavailable } = await searchPublicContent(q);
  return <EditorialShell title="Find your next discovery" eyebrow="Search Korea">
    <form action="/search" className="mb-8 flex flex-wrap gap-3" role="search"><label className="min-w-0 flex-1"><span className="sr-only">Search culture, places and experiences</span><input name="q" defaultValue={q} maxLength={80} placeholder="Try music, cafés, or Seongsu" className="w-full rounded-full border border-[#ccd2cb] bg-white px-5 py-3" /></label><button className="rounded-full bg-[#17201d] px-6 py-3 font-semibold text-white">Search</button></form>
    <p className="mb-6 text-sm text-[#69736c]">Published topics, stories, places and experiences · Up to 20 matches per content type.</p>
    {unavailable && <p role="alert" className="mb-6 rounded-xl bg-[#f4f7f0] p-4">Some results are temporarily unavailable. Please try again later.</p>}
    {!q ? <p>Enter a topic or neighborhood to begin.</p> : cards.length ? <><p className="mb-5">Results for “{q}”</p><DiscoveryCards cards={cards} /></> : !unavailable && <p>No published discoveries match “{q}”. Try a broader topic.</p>}
  </EditorialShell>;
}
