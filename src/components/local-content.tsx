import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ReviewForm } from "@/components/review-form";
import { PublicReviews } from "@/components/public-reviews";
import { submitReview } from "@/lib/submit-review";
import type { ReactNode } from "react";
import { ContentImage } from "@/components/content-image";
import { DiscoveryCards } from "@/components/discovery-cards";
import { filterTerm } from "@/lib/discovery";
import { RelatedContent } from "@/components/cluster-content";

type Kind = "places" | "experiences";
type LocalItem = { id: string; name: string; area: string; category: string; description: string; visitor_info: string | null; image_url: string | null; image_alt: string | null };

export function LocalPageShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="min-h-screen bg-[#fcfcfa] text-[#18201d]"><SiteHeader />
    <section className="border-y border-[#e4e8e1] bg-[#f4f7f0]"><div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#557b39]">Local Korea</p>
      <h1 className="mt-4 break-words text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[#69736c]">{description}</p>
    </div></section>
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-10">{children}</div><SiteFooter />
  </main>;
}

export async function LocalContentList({ kind, filter }: { kind: Kind; filter?: unknown }) {
  let items: LocalItem[] | null = null;
  try {
    const client = await createClient();
    const { data, error } = await client.from(kind).select("id,name,area,category,description,image_url,image_alt")
      .eq("status", "published").order("published_at", { ascending: false }).limit(100);
    if (!error && data) items = data.map((item) => ({ ...item, visitor_info: null }));
  } catch { /* Show a safe read failure, including when the migration is not applied. */ }
  const title = kind === "places" ? "Places" : "Experiences";
  const field = kind === "places" ? "area" : "category";
  const selected = filterTerm(filter);
  const options = [...new Set((items ?? []).map(item => item[field]))].sort();
  const visible = selected ? (items ?? []).filter(item => item[field] === selected) : items ?? [];
  return <LocalPageShell title={title} description={kind === "places" ? "Discover local places across Korea. Choose a place to read visitor information and write a review." : "Explore local activities and cultural experiences. Discover what to expect before you visit."}>
    <nav aria-label={`Filter by ${field}`} className="mb-8 flex flex-wrap gap-3">{["", ...options].map(option => <Link key={option} href={`/local-korea/${kind}${option ? `?${field}=${encodeURIComponent(option)}` : ""}`} aria-current={selected === option ? "page" : undefined} className={`max-w-full break-words rounded-full border border-[#dce2dc] px-5 py-2 text-sm ${selected === option ? "bg-[#17201d] text-white" : "bg-white"}`}>{option || "All"}</Link>)}</nav>
    {items === null ? <p role="alert">We couldn’t load {kind}. Please try again later.</p> : !visible.length ? <p>No published {kind} match this filter. Choose All to explore more.</p> : <DiscoveryCards cards={visible.map(item => ({ ...item, title: item.name, summary: item.description, href: `/local-korea/${kind}/${item.id}`, label: `${item.category} · ${item.area}` }))} />}
  </LocalPageShell>;
}

export async function LocalContentDetail({ kind, id }: { kind: Kind; id: string }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  let item: LocalItem | null = null;
  try {
    const client = await createClient();
    const { data, error } = await client.from(kind).select("id,name,area,category,description,visitor_info,image_url,image_alt")
      .eq("id", id).eq("status", "published").maybeSingle();
    if (!error && data) item = data;
  } catch { /* Fail closed; do not reveal private or unavailable content. */ }
  if (!item) notFound();
  let authenticated = false;
  if (kind === "places") {
    try {
      const client = await createClient();
      const { data, error } = await client.auth.getUser();
      authenticated = !error && !!data.user;
    } catch { /* Keep public content available without a session. */ }
  }
  const placeId = item.id;
  const loginHref = `/login?next=${encodeURIComponent(`/local-korea/places/${placeId}`)}`;
  async function reviewAction(formData: FormData) {
    "use server";
    return submitReview(placeId, formData);
  }
  return <LocalPageShell title={item.name} description={`${item.category} · ${item.area}`}>
    <div className="mx-auto max-w-4xl">
      <article className="rounded-[2rem] border border-[#e3e7e2] bg-white p-7 sm:p-10">
        <div className="mb-7"><ContentImage url={item.image_url} alt={item.image_alt} sizes="(max-width: 768px) 100vw, 896px" /></div>
        <p className="whitespace-pre-wrap break-words leading-8 text-[#56625a]">{item.description}</p>
        {item.visitor_info && <section className="mt-8"><h2 className="text-xl font-semibold">Before you visit</h2><p className="mt-3 whitespace-pre-wrap break-words leading-7 text-[#69736c]">{item.visitor_info}</p></section>}
      </article>
      {kind === "places" && <><PublicReviews placeId={placeId} />
        {authenticated ? <ReviewForm key={placeId} submitAction={reviewAction} loginHref={loginHref} /> : <section className="mt-8 rounded-2xl border border-[#e3e7e2] bg-white p-7"><h2 className="text-xl font-semibold">Share your visit</h2><p className="mt-3 text-sm text-[#69736c]">Reviews appear publicly after approval.</p><Link href={loginHref} className="mt-5 inline-block rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white">Log in to review</Link></section>}
      </>}
      <RelatedContent target={kind === "places" ? "place_id" : "experience_id"} id={id}/>
      <Link href={`/local-korea/${kind}`} className="mt-8 inline-block text-sm font-semibold underline">← Back to {kind}</Link>
    </div>
  </LocalPageShell>;
}
