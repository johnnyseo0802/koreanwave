import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function ConfirmationFailedPage() {
  return <main className="min-h-screen bg-[#fcfcfa] text-[#18201d]"><SiteHeader /><section className="mx-auto flex max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-10"><div className="w-full max-w-xl rounded-[2rem] border border-[#e3e7e2] bg-white p-7 sm:p-10"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#557b39]">Confirmation needed</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em]">We couldn’t confirm that link.</h1><p className="mt-4 text-base leading-7 text-[#717a74]">The link may have expired or already been used. Please return to sign up and request a new confirmation email.</p><Link className="mt-8 inline-flex rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white" href="/signup">Return to sign up →</Link></div></section><SiteFooter /></main>;
}
