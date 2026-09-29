import Link from "next/link";
import { CommunityCards, CommunityShell, communityButton } from "@/components/community-shell";
import { communityFeed, weeklyPrompt } from "@/lib/community-data";
export const metadata = { title: "Community" };
const filters = [["all","All"],["moment","Moments"],["story","Stories"],["tip","Tips"],["questions","Questions"],["reviews","Reviews"]];
export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const filter = filters.some(([key]) => key === type) ? type! : "all";
  const [feed, prompt] = await Promise.all([communityFeed(filter), weeklyPrompt()]);
  return <CommunityShell title="Community" description="See Korea through the people who live here and love it.">
    <Link href="/write" className={communityButton}>Share your Korea →</Link>
    {prompt && <aside className="my-8 rounded-2xl bg-[#edf3e5] p-6"><p className="text-xs uppercase tracking-widest">This week’s question</p><h2 className="mt-3 break-words text-2xl font-semibold">{prompt.prompt}</h2><Link className="mt-4 inline-block py-2 font-semibold underline" href={`/write/${prompt.suggested_type}?prompt=weekly`}>Share your answer →</Link></aside>}
    <nav aria-label="Community filters" className="my-8 flex flex-wrap gap-3">{filters.map(([key,label]) => <Link key={key} href={`/community?type=${key}`} aria-current={filter===key ? "page" : undefined} className={`rounded-full border px-5 py-3 text-sm ${filter===key ? "bg-[#17201d] text-white" : "bg-white"}`}>{label}</Link>)}</nav>
    {feed.unavailable && <p role="alert" className="mb-6">Some contributions couldn’t be loaded. Please try again later.</p>}
    <CommunityCards cards={feed.cards} />
    {!feed.cards.length && !feed.unavailable && <div className="rounded-2xl border bg-white p-8"><h2 className="text-xl font-semibold">{filter==="moment" ? "Be the first to share a Korea moment." : filter==="story" ? "Have a Korea experience worth sharing?" : filter==="tip" ? "Share something you wish you’d known." : "Your Korea belongs here."}</h2><p className="mt-3">No published contributions here yet.</p><Link href="/write" className="mt-4 inline-block py-3 underline">Start sharing</Link></div>}
    <p className="mt-6 text-sm text-[#69736c]">Showing up to 30 newest published contributions.</p>
  </CommunityShell>;
}
