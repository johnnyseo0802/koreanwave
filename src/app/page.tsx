import Link from "next/link";
import { Suspense } from "react";
import { HomeEvents } from "@/components/home-events";
import { HomeClusters } from "@/components/cluster-content";
import { HomeEditorial, HomeConversations } from "@/components/home-editorial";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brand } from "@/lib/brand";
import { publicPageMetadata } from "@/lib/public-metadata";

export const metadata = publicPageMetadata(`${brand.name} — ${brand.headline}`, "/");

const Loading = () => <p className="groov-section" role="status">Finding your next discovery…</p>;

export default function Home() {
  return <main className="groov-home"><SiteHeader />
    <section className="groov-hero">
      <div><p className="groov-kicker">Seoul energy. Global connections.</p><h1>Korea Is<br />a <span>Vibe.</span></h1><p className="groov-hero-description">{brand.description}</p>
        <div className="groov-hero-actions mt-8 flex flex-wrap gap-3"><Link className="groov-button" href="/local-korea">Explore Korea ↗</Link><Link className="groov-button groov-button-secondary" href="/community">Find your community ↗</Link></div>
        <form role="search" action="/search" className="groov-search"><label className="min-w-0 flex-1"><span className="sr-only">Search Korea</span><input name="q" maxLength={80} placeholder="Stories, places, experiences…" /></label><button type="submit">Search ↗</button></form>
      </div>
      <div className="groov-poster" aria-label="KGROOV: Find Your Groove. Original brand graphic">
        <div className="flex justify-between gap-3 text-xs font-bold tracking-widest"><span>KGROOV</span><span>SEOUL → EVERYWHERE</span></div>
        <div className="groov-orbits" aria-hidden="true"><i /><i /><i /></div>
        <div className="relative"><p className="groov-poster-word">FIND<br />YOUR<br /><span>GROOVE.</span></p><p className="groov-poster-caption mt-5 text-sm">Discover the new Korea. Be part of it.</p></div>
      </div>
    </section>
    <div className="groov-strip" aria-label="Explore topics">{[["Music & screen", "/k-contents"], ["Style & taste", "/k-trends"], ["Local discoveries", "/local-korea"], ["Community Conversations", "#community-conversations"], ["Ask a Local", "/community/questions"]].map(([label, href]) => <Link key={href} href={href}>{label} ↗</Link>)}</div>
    <Suspense fallback={<Loading />}><HomeEditorial /></Suspense>
    <div className="groov-lifestyle"><Suspense fallback={<Loading />}><HomeEditorial lifestyle /></Suspense></div>
    <Suspense fallback={<Loading />}><HomeConversations /></Suspense>
    <section className="groov-section"><div className="groov-section-heading"><div><p className="groov-kicker">Beyond the feed</p><h2>Go find your Korea.</h2></div><Link href="/explore" className="groov-text-link">Explore all guides ↗</Link></div><div className="groov-explore">{[["01", "Places & travel", "A new neighborhood. A different perspective.", "/local-korea/places"], ["02", "Experiences", "Make room for something you haven’t tried.", "/local-korea/experiences"], ["03", "Living in Korea", "Everyday questions, answered by the community.", "/community/questions"], ["04", "Events", "Take the conversation into the real world.", "/events"]].map(([n, title, description, href]) => <Link key={href} href={href}><span className="groov-kicker">{n} / EXPLORE</span><h3>{title} ↗</h3><p>{description}</p></Link>)}</div></section>
    <Suspense fallback={null}><HomeClusters /></Suspense>
    <section className="groov-section"><div className="groov-events"><div><p className="groov-kicker">From online to out there</p><h2 className="mt-4 text-4xl font-semibold tracking-tight">Good company.<br />New experiences.</h2><p className="mt-5 max-w-md leading-7">Discover local gatherings. Exact meeting details stay private and are shared only with approved participants.</p><Link href="/events" className="groov-button mt-7 inline-block">Browse events ↗</Link></div><Suspense fallback={<p role="status">Loading gatherings…</p>}><HomeEvents /></Suspense></div></section>
    <section className="groov-section text-center"><p className="groov-kicker">{brand.tagline}</p><h2 className="mt-4 text-4xl font-semibold tracking-tight">Your perspective belongs here.</h2><Link href="/founding-members" className="groov-text-link mt-6 inline-block">Help shape our first chapter ↗</Link></section>
    <SiteFooter />
  </main>;
}
