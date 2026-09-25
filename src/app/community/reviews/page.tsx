export const metadata = { title: "Community reviews" };

import Link from "next/link";
import { LocalPageShell } from "@/components/local-content";
import { PublicReviews } from "@/components/public-reviews";
export default function ReviewsPage() {
  return <LocalPageShell title="Community reviews" description="Read approved notes from visitors and find a place for your next Korea experience.">
    <Link href="/local-korea/places" className="inline-block rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white">Choose a place to review</Link>
    <PublicReviews />
  </LocalPageShell>;
}
