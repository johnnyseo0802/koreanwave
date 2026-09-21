import Link from "next/link";

const navigation = [
  { label: "K-Contents", href: "/k-contents" },
  { label: "Local Korea", href: "/local-korea" },
  { label: "K-Trends", href: "/k-trends" },
  { label: "Community", href: "/community" },
  { label: "Events", href: "/events" },
];

export function SiteHeader() {
  return (
    <header className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
      <Link className="flex shrink-0 items-center gap-2.5 text-[15px] font-semibold tracking-[-0.03em]" href="/">
        <span className="grid size-8 place-items-center rounded-xl bg-[#17201d] text-sm text-white">K</span>
        Korean Wave <span className="hidden sm:inline">Community</span>
      </Link>
      <nav aria-label="Main navigation" className="hidden flex-1 items-center justify-center gap-4 text-[13px] font-medium text-[#5b635f] md:flex lg:gap-7 lg:text-sm">
        {navigation.map((item) => <Link className="whitespace-nowrap transition hover:text-[#17201d]" href={item.href} key={item.href}>{item.label}</Link>)}
      </nav>
      <div className="hidden shrink-0 items-center gap-4 sm:flex">
        <Link className="text-sm font-medium text-[#3b4540] transition hover:text-black" href="/login">Log in</Link>
        <Link className="rounded-full bg-[#17201d] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#35413c]" href="/signup">Join free</Link>
      </div>
      <details className="relative sm:hidden">
        <summary aria-label="Open menu" className="grid size-10 cursor-pointer place-items-center rounded-full border border-[#dfe3df] bg-white text-lg list-none">☰</summary>
        <nav aria-label="Mobile navigation" className="absolute right-0 z-30 mt-2 w-56 rounded-2xl border border-[#e3e6e3] bg-white p-2 shadow-xl shadow-black/10">
          {navigation.map((item) => <Link className="block rounded-xl px-4 py-3 text-sm font-medium hover:bg-[#f4f5f2]" href={item.href} key={item.href}>{item.label}</Link>)}
          <Link className="mt-1 block rounded-xl bg-[#17201d] px-4 py-3 text-center text-sm font-medium text-white" href="/signup">Join free</Link>
        </nav>
      </details>
    </header>
  );
}
