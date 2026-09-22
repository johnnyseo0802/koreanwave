"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthenticated } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase/client";

const navigation = [
  { label: "K-Contents", href: "/k-contents" },
  { label: "Local Korea", href: "/local-korea" },
  { label: "K-Trends", href: "/k-trends" },
  { label: "Community", href: "/community" },
  { label: "Events", href: "/events" },
];

export function SiteHeader() {
  const authenticated = useAuthenticated();
  const router = useRouter();
  const logoutLock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (logoutLock.current) return;
    logoutLock.current = true;
    setPending(true);
    setError("");
    try {
      const client = createClient();
      const { error } = await client.auth.signOut();
      if (error) {
        setError("Could not log out. Please try again.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not log out. Please check your connection and try again.");
    } finally {
      logoutLock.current = false;
      setPending(false);
    }
  }

  return (
    <header className="relative mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
      <Link className="flex shrink-0 items-center gap-2.5 text-[15px] font-semibold tracking-[-0.03em]" href="/">
        <span className="grid size-8 place-items-center rounded-xl bg-[#17201d] text-sm text-white">K</span>
        Korean Wave <span className="hidden sm:inline">Community</span>
      </Link>
      <nav aria-label="Main navigation" className="hidden flex-1 items-center justify-center gap-4 text-[13px] font-medium text-[#5b635f] md:flex lg:gap-7 lg:text-sm">
        {navigation.map((item) => <Link className="whitespace-nowrap transition hover:text-[#17201d]" href={item.href} key={item.href}>{item.label}</Link>)}
      </nav>
      <div className="hidden shrink-0 items-center gap-4 sm:flex">
        <Link className="whitespace-nowrap text-sm font-medium text-[#3b4540] transition hover:text-black" href={authenticated ? "/account" : "/login"}>{authenticated ? "My Account" : "Log in"}</Link>
        {authenticated ? <button type="button" disabled={pending} onClick={logout} className="whitespace-nowrap rounded-full bg-[#17201d] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#35413c] disabled:cursor-wait disabled:opacity-60">{pending ? "Logging out…" : "Log out"}</button> : <Link className="rounded-full bg-[#17201d] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#35413c]" href="/signup">Join free</Link>}
      </div>
      <details className="relative sm:hidden">
        <summary aria-label="Open menu" className="grid size-10 cursor-pointer place-items-center rounded-full border border-[#dfe3df] bg-white text-lg list-none">☰</summary>
        <nav aria-label="Mobile navigation" className="absolute right-0 z-30 mt-2 w-56 rounded-2xl border border-[#e3e6e3] bg-white p-2 shadow-xl shadow-black/10">
          {navigation.map((item) => <Link className="block rounded-xl px-4 py-3 text-sm font-medium hover:bg-[#f4f5f2]" href={item.href} key={item.href}>{item.label}</Link>)}
          <Link className="block rounded-xl px-4 py-3 text-sm font-medium hover:bg-[#f4f5f2]" href={authenticated ? "/account" : "/login"}>{authenticated ? "My Account" : "Log in"}</Link>
          {authenticated ? <button type="button" disabled={pending} onClick={logout} className="mt-1 block w-full rounded-xl bg-[#17201d] px-4 py-3 text-center text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60">{pending ? "Logging out…" : "Log out"}</button> : <Link className="mt-1 block rounded-xl bg-[#17201d] px-4 py-3 text-center text-sm font-medium text-white" href="/signup">Join free</Link>}
        </nav>
      </details>
      {error && <p role="alert" className="absolute right-5 top-full z-40 max-w-sm rounded-xl border border-[#e3e6e3] bg-white p-3 text-sm text-[#a1432d] shadow-lg">{error}</p>}
    </header>
  );
}
