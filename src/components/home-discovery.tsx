import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listPublicArticles } from "@/lib/editorial-data";
import { DiscoveryCards } from "@/components/discovery-cards";
import { SectionHeading } from "@/components/section-heading";
import type { DiscoveryCard } from "@/lib/discovery";

async function localCards(kind: "places" | "experiences"): Promise<DiscoveryCard[] | null> {
  try {
    const client = await createClient();
    const { data, error } = await client.from(kind).select("id,name,description,area,category,image_url,image_alt")
      .eq("status", "published").order("published_at", { ascending: false }).limit(3);
    return error ? null : (data ?? []).map(item => ({ ...item, title: item.name, summary: item.description, label: `${kind} · ${item.area}`, href: `/local-korea/${kind}/${item.id}` }));
  } catch { return null; }
}
export async function HomeDiscovery({ section }: { section: "k-contents" | "k-trends" | "local-korea" | "community" }) {
  let cards: DiscoveryCard[] | null = null;
  let partial = false;
  if (section === "k-contents" || section === "k-trends") {
    const articles = await listPublicArticles(section, undefined, 3);
    cards = articles?.map(a => ({ ...a, label: a.category, href: `/articles/${a.id}` })) ?? null;
  } else if (section === "local-korea") {
    const groups = await Promise.all([localCards("places"), localCards("experiences")]);
    partial = groups.some(g => g === null);
    cards = groups.every(g => g === null) ? null : [groups[0]?.[0], groups[1]?.[0], groups[0]?.[1], groups[1]?.[1], groups[0]?.[2], groups[1]?.[2]].filter((card): card is DiscoveryCard => !!card).slice(0, 3);
  } else {
    try {
      const client = await createClient();
      const { data, error } = await client.from("questions").select("id,title,body,published_at")
        .eq("status", "approved").order("published_at", { ascending: false }).limit(3);
      if (!error) cards = (data ?? []).map(q => ({ id: q.id, title: q.title, summary: q.body, label: "Ask a Local", href: `/community/questions/${q.id}` }));
    } catch { /* Keep every homepage section independent and public-only. */ }
  }
  const title = { "k-contents": "K-Contents", "k-trends": "K-Trends", "local-korea": "Discover Local Korea", community: "Connect with people who love Korea" }[section];
  const href = section === "community" ? "/community/questions" : `/${section}`;
  return <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
    <SectionHeading eyebrow={section === "community" ? "From the community" : "Fresh discoveries"} title={title} copy={section === "community" ? "Real questions, shared curiosity. Find perspectives before your next visit." : "Explore our latest published stories and places at your own pace."} />
    <div className="mt-8">{cards === null ? <p role="status" className="rounded-2xl bg-[#f4f7f0] p-6">These discoveries are temporarily unavailable. Please check back soon.</p> : cards.length ? <DiscoveryCards cards={cards} images={section !== "community"} /> : <p className="rounded-2xl bg-[#f4f7f0] p-6">New discoveries are on the way. Explore the section or check back soon.</p>}</div>
    {partial && cards !== null && <p className="mt-4 text-sm text-[#69736c]">Some local discoveries are temporarily unavailable.</p>}
    <Link href={href} className="mt-6 inline-block font-semibold text-[#557b39] underline">Explore {section === "community" ? "Ask a Local" : title} →</Link>
  </section>;
}
