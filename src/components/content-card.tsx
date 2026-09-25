import Link from "next/link";

export type ContentCardData = { title: string; description: string; meta: string; href: string; tone?: string };

export function ContentCard({ card }: { card: ContentCardData }) {
  return <Link className="group min-w-0 rounded-2xl border border-[#e3e7e2] bg-white p-3 text-[#18201d] transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#334939]/10" href={card.href}>
    <div className={`flex aspect-[1.3/1] flex-col justify-between rounded-xl bg-gradient-to-br p-4 ${card.tone ?? "from-[#dce8ff] via-[#dceee4] to-[#ffe1c7]"}`}><span className="w-fit rounded-full bg-white/75 px-2.5 py-1 text-[11px] font-semibold text-[#34443b]">{card.meta}</span><div className="flex items-end justify-between"><span className="text-4xl font-semibold tracking-[-0.08em] text-[#1d2923]/65">{card.title.charAt(0)}</span><span className="grid size-8 place-items-center rounded-full bg-[#17201d] text-sm text-white transition group-hover:translate-x-1 group-hover:-translate-y-1">↗</span></div></div>
    <div className="px-1 pb-1 pt-4"><h3 className="font-semibold">{card.title}</h3><p className="mt-1 text-sm leading-5 text-[#747d77]">{card.description}</p></div>
  </Link>;
}
