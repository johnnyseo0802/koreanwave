import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#e4e8e1] bg-white">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
        <div className="flex flex-col justify-between gap-8 lg:flex-row"><div><Link className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.03em]" href="/"><span className="grid size-8 place-items-center rounded-xl bg-[#17201d] text-sm text-white">K</span>Korean Wave Community</Link><p className="mt-3 max-w-xs text-sm leading-6 text-[#717a74]">A global community for Korean culture, local stories, and meaningful connections.</p></div><div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-[#68736b] sm:grid-cols-3">{[["About", "/about"], ["Safety & guidelines", "/safety"], ["FAQ", "/faq"], ["Contact", "/contact"], ["Privacy", "/privacy"], ["Terms", "/terms"], ["Cancellation", "/cancellation"]].map(([label, href]) => <Link className="py-1 transition hover:text-[#17201d]" href={href} key={href}>{label}</Link>)}</div></div>
        <div className="mt-10 border-t border-[#edf0ec] pt-5 text-xs text-[#929a94]">© 2026 Korean Wave Community. Made for every way you love Korea.</div>
      </div>
    </footer>
  );
}
