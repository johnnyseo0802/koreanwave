"use client";

import Link from "next/link";
import { useAuthenticated } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function AccountPage() {
  const authenticated = useAuthenticated();
  return (
    <main className="min-h-screen bg-[#fcfcfa] text-[#18201d]">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#789a50]">Your community</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">My Account</h1>
        <p className="mt-4 text-base leading-7 text-[#69736c]">{authenticated ? "You’re logged in. Welcome to your space in Korean Wave Community." : "Log in to access your account."}</p>
        {authenticated ? <div className="mt-10 grid gap-4 sm:grid-cols-3">{[
          ["Profile", "Your community profile will have a home here."],
          ["My Submissions", "A space for the stories and experiences you share."],
          ["My Events", "A space for your future community events."],
        ].map(([title, description]) => <section key={title} className="rounded-[2rem] border border-[#e3e7e2] bg-white p-7"><h2 className="text-xl font-semibold">{title}</h2><p className="mt-3 text-sm leading-6 text-[#717a74]">{description}</p></section>)}</div> : <Link href="/login" className="mt-8 inline-flex rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white">Log in →</Link>}
      </section>
      <SiteFooter />
    </main>
  );
}
