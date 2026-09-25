import { notFound, redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { ReviewModerationQueue, type PendingReview } from "@/components/review-moderation-queue";
import { AdminModerationNav } from "@/components/admin-moderation-nav";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default async function AdminReviewsPage() {
  const access = await getAdminAccess();
  if (access.status === "unauthenticated") redirect("/login?next=/admin/reviews");
  if (access.status !== "admin") notFound();
  let reviews: PendingReview[] | null = null;
  try {
    const { data, error } = await access.client.from("reviews")
      .select("id,place_id,body,created_at,status").eq("status", "pending")
      .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(100);
    if (!error && data) {
      const ids = [...new Set(data.map((review) => review.place_id))];
      const titles = new Map<string, string>();
      if (ids.length) {
        const context = await access.client.from("places").select("id,name").in("id", ids);
        if (context.error) throw new Error("Place context unavailable");
        for (const place of context.data ?? []) titles.set(place.id, place.name);
      }
      reviews = data.map((review) => ({
        id: review.id, body: review.body, created_at: review.created_at,
        status: review.status, place_name: titles.get(review.place_id) ?? "Place unavailable",
      }));
    }
  } catch {
    // Do not expose private data or raw database errors.
  }
  return <main className="min-h-screen bg-[#fcfcfa] text-[#18201d]">
    <SiteHeader />
    <section className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-20">
      <AdminModerationNav active="reviews" />
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#557b39]">Community moderation</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em]">Pending reviews</h1>
      <p className="mt-4 text-base leading-7 text-[#69736c]">Review member experiences before publication. Decisions cannot be reversed here.</p>
      <p className="mt-2 text-sm text-[#69736c]">Showing up to 100 oldest pending reviews. The queue refreshes after each decision.</p>
      {reviews ? <ReviewModerationQueue reviews={reviews} /> : <p role="alert" className="mt-8 rounded-2xl bg-white p-6">We couldn’t load the queue. Please refresh the page or try again later.</p>}
    </section>
    <SiteFooter />
  </main>;
}
