import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type PublicReview = { id: string; place_id: string; body: string; published_at: string };

export async function PublicReviews({ placeId }: { placeId?: string }) {
  let reviews: PublicReview[] | null = null;
  try {
    const client = await createClient();
    // Explicit parent filter also protects the community feed for authenticated
    // authors/admins, whose RLS can expose their own/private review rows.
    let query = client.from("reviews").select("id,place_id,body,published_at,places!inner(status)")
      .eq("status", "approved").eq("places.status", "published");
    if (placeId) query = query.eq("place_id", placeId);
    const { data, error } = await query.order("published_at", { ascending: !placeId ? false : true });
    if (!error && data) reviews = data.map(({ id, place_id, body, published_at }) => ({ id, place_id, body, published_at }));
  } catch { /* Safe read failure; no raw database output. */ }
  return <section aria-label="Published reviews" className="mt-8"><h2 className="text-2xl font-semibold">Reviews</h2>
    {reviews === null ? <p role="alert" className="mt-4">We couldn’t load reviews. Please try again later.</p> : !reviews.length ? <p className="mt-4 text-[#69736c]">No reviews have been published yet.</p> : <div className="mt-5 space-y-4">{reviews.map((review) => <article key={review.id} className="rounded-2xl border border-[#e3e7e2] bg-white p-6">
      <time className="text-xs text-[#557b39]" dateTime={review.published_at}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(review.published_at))}</time>
      <p className="mt-3 whitespace-pre-wrap break-words leading-7 text-[#56625a]">{review.body}</p>
      {!placeId && <Link className="mt-4 inline-block text-sm font-semibold underline" href={`/local-korea/places/${review.place_id}`}>View place</Link>}
    </article>)}</div>}
  </section>;
}
