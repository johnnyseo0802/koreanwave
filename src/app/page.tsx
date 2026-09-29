import Link from "next/link";
import { Suspense } from "react";
import { HomeEvents } from "@/components/home-events";
import { HomeDiscovery } from "@/components/home-discovery";
import { HomeCommunity } from "@/components/home-community";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return <main className="min-h-screen bg-[#fcfcfa] text-[#18201d]"><SiteHeader />
    <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-12 sm:px-8 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
      <div><p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#71816d]">Your Korea, your way</p><h1 className="text-5xl font-semibold tracking-[-0.065em] sm:text-6xl lg:text-7xl">Discover Korea <span className="text-[#557b39]">Beyond</span> the Screen</h1><p className="mt-6 max-w-xl text-lg leading-8 text-[#626c66]">Discover Korean culture, explore local Korea, and connect with people who love Korea.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link className="rounded-full bg-[#17201d] px-6 py-3.5 text-sm font-semibold text-white" href="/local-korea">Explore Korea →</Link><Link className="rounded-full border border-[#ccd2cb] bg-white px-6 py-3.5 text-sm font-semibold" href="/signup">Join the Community</Link></div>
        <form role="search" action="/search" className="mt-8 flex gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Search Korea</span><input name="q" maxLength={80} placeholder="Stories, places, experiences…" className="w-full rounded-full border border-[#ccd2cb] bg-white px-5 py-3" /></label><button className="rounded-full bg-[#e9efdf] px-5 font-semibold">Search</button></form>
      </div>
      <Link href="/local-korea" className="flex aspect-[4/4.5] flex-col justify-between rounded-[2rem] bg-gradient-to-br from-[#669286] via-[#a7c5aa] to-[#ece0bd] p-7"><span className="self-start rounded-full bg-white/85 px-4 py-2 text-xs font-semibold">Seoul, Korea</span><div className="rounded-2xl bg-white/90 p-6"><p className="text-xs uppercase tracking-widest text-[#71816d]">Explore at your pace</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Find your side of Seoul →</h2><p className="mt-3 text-sm text-[#647068]">Places · Experiences · Events</p></div></Link>
    </section>
    <Suspense fallback={<p className="px-5 py-12">Loading community…</p>}><HomeCommunity /></Suspense>
    {(["k-contents", "local-korea", "k-trends", "community"] as const).map(section => <Suspense key={section} fallback={<div className="mx-auto max-w-7xl px-5 py-12" role="status">Loading discoveries…</div>}><HomeDiscovery section={section} /></Suspense>)}
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-10"><div className="grid gap-8 rounded-[2rem] bg-[#efc5b4] p-6 sm:p-10 lg:grid-cols-2"><div><p className="text-xs uppercase tracking-widest text-[#8d4c3b]">What&apos;s happening</p><h2 className="mt-4 text-4xl font-semibold tracking-tight text-[#432f2b]">Meet Korea in the moment.</h2><p className="mt-5 leading-7 text-[#75564e]">Discover cultural gatherings and community events. Exact meeting instructions are shared only with approved participants.</p><Link href="/events" className="mt-7 inline-block rounded-full bg-[#432f2b] px-5 py-3 font-semibold text-white">Browse events →</Link></div><Suspense fallback={<p>Loading gatherings…</p>}><HomeEvents /></Suspense></div></section>
    <section className="mx-auto max-w-7xl px-5 py-16 text-center"><h2 className="text-3xl font-semibold">Make Korea feel closer.</h2><p className="mt-4 text-[#626c66]">Ask a question, share a useful review, or join a local gathering.</p><Link href="/write/question" className="mt-6 inline-block rounded-full bg-[#17201d] px-6 py-3 font-semibold text-white">Ask a Local</Link></section><SiteFooter />
  </main>;
}
