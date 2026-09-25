import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ReviewForm } from "@/components/review-form";
import { PublicReviews } from "@/components/public-reviews";
import { submitReview } from "@/lib/submit-review";
import type { ReactNode } from "react";

type Kind = "places" | "experiences";
type LocalItem = { id: string; name: string; area: string; category: string; description: string; visitor_info: string | null };

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

export async function LocalContentList({ kind }: { kind: Kind }) {
  let items: LocalItem[] | null = null;
  try {
    const client = await createClient();
    const { data, error } = await client.from(kind).select("id,name,area,category,description")
      .eq("status", "published").order("published_at", { ascending: false });
    if (!error && data) items = data.map((item) => ({ ...item, visitor_info: null }));
  } catch { /* Show a safe read failure, including when the migration is not applied. */ }
  const title = kind === "places" ? "Places" : "Experiences";
  return <LocalPageShell title={title} description={kind === "places" ? "Discover local places across Korea. Choose a place to read visitor information and write a review." : "Explore local activities and cultural experiences. Discover what to expect before you visit."}>
    {items === null ? <p role="alert">We couldn’t load {kind}. Please try again later.</p> : !items.length ? <p>No {kind} have been published yet.</p> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <Link key={item.id} href={`/local-korea/${kind}/${item.id}`} className="rounded-2xl border border-[#e3e7e2] bg-white p-4 transition hover:shadow-lg">
      <div aria-hidden="true" className="flex aspect-[2/1] items-end rounded-xl bg-gradient-to-br from-[#dceee4] to-[#ffe1c7] p-5 text-3xl font-semibold text-[#34443b]">{item.name.charAt(0)}</div>
      <p className="mt-4 text-xs font-medium text-[#557b39]">{item.category} · {item.area}</p>
      <h2 className="mt-2 break-words text-xl font-semibold">{item.name}</h2>
      <p className="mt-3 line-clamp-3 break-words text-sm leading-6 text-[#69736c]">{item.description}</p>
    </Link>)}</div>}
  </LocalPageShell>;
}

export async function LocalContentDetail({ kind, id }: { kind: Kind; id: string }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  let item: LocalItem | null = null;
  try {
    const client = await createClient();
    const { data, error } = await client.from(kind).select("id,name,area,category,description,visitor_info")
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
        <p className="whitespace-pre-wrap break-words leading-8 text-[#56625a]">{item.description}</p>
        {item.visitor_info && <section className="mt-8"><h2 className="text-xl font-semibold">Before you visit</h2><p className="mt-3 whitespace-pre-wrap break-words leading-7 text-[#69736c]">{item.visitor_info}</p></section>}
      </article>
      {kind === "places" && <><PublicReviews placeId={placeId} />
        {authenticated ? <ReviewForm key={placeId} submitAction={reviewAction} loginHref={loginHref} /> : <section className="mt-8 rounded-2xl border border-[#e3e7e2] bg-white p-7"><h2 className="text-xl font-semibold">Share your visit</h2><p className="mt-3 text-sm text-[#69736c]">Reviews appear publicly after approval.</p><Link href={loginHref} className="mt-5 inline-block rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white">Log in to review</Link></section>}
      </>}
      <Link href={`/local-korea/${kind}`} className="mt-8 inline-block text-sm font-semibold underline">← Back to {kind}</Link>
    </div>
  </LocalPageShell>;
}
