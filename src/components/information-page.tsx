import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { informationPages, type InformationPageKey } from "@/lib/information-pages";

export function InformationPage({ page }: { page: InformationPageKey }) {
  const info = informationPages[page];
  return <main className="min-h-screen bg-[#fcfcfa] text-[#18201d]"><SiteHeader /><article className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-20">
    <p className="text-xs font-semibold uppercase tracking-widest text-[#557b39]">Korean Wave Community</p>
    <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">{info.title}</h1>
    <p className="mt-5 text-lg leading-8 text-[#626c66]">{info.intro}</p>
    <div className="mt-10 space-y-6">{info.sections.map(([title, body]) => <section key={title} className="rounded-2xl border border-[#e3e7e2] bg-white p-6 sm:p-8"><h2 className="text-xl font-semibold">{title}</h2><p className="mt-3 leading-7 text-[#626c66]">{body}</p></section>)}</div>
    <nav aria-label="Information pages" className="mt-10 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold">{Object.entries(informationPages).map(([key, value]) => <Link key={key} href={`/${key}`} aria-current={key === page ? "page" : undefined} className="underline">{key === "about" ? "About" : value.title.split(" — ")[0]}</Link>)}</nav>
    <Link href="/" className="mt-8 inline-block rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white">← Back home</Link>
  </article><SiteFooter /></main>;
}
