import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function NotFound() {
  return <main className="min-h-screen bg-[#fcfcfa] text-[#18201d]"><SiteHeader /><section className="mx-auto max-w-3xl px-5 py-20 sm:px-8"><p className="text-sm font-semibold text-[#557b39]">404</p><h1 className="mt-4 text-4xl font-semibold tracking-tight">This page isn’t available.</h1><p className="mt-5 leading-7 text-[#626c66]">The link may be incorrect or the content may no longer be available.</p><div className="mt-8 flex flex-wrap gap-4"><Link href="/" className="rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white">Back home</Link><Link href="/community/questions" className="rounded-full border border-[#dce2dc] px-5 py-3 text-sm font-semibold">Ask a Local</Link></div></section><SiteFooter /></main>;
}
