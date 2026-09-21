export function SectionHeading({ eyebrow, title, copy, dark = false }: { eyebrow: string; title: string; copy: string; dark?: boolean }) {
  return <div className="max-w-xl"><p className={`text-xs font-semibold uppercase tracking-[0.16em] ${dark ? "text-[#b7d093]" : "text-[#789a50]"}`}>{eyebrow}</p><h2 className={`mt-3 text-3xl font-semibold tracking-[-0.055em] sm:text-4xl ${dark ? "text-white" : "text-[#17201d]"}`}>{title}</h2><p className={`mt-3 text-base leading-7 ${dark ? "text-[#c7d1ca]" : "text-[#69736c]"}`}>{copy}</p></div>;
}
