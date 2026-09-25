import { MvpListingPage } from "@/components/mvp-listing-page";
import { makeCards } from "@/lib/navigation-cards";
import { requireUser } from "@/lib/auth/require-user";
const cards = makeCards([["Ask a Question", "Ask the community about Korea. Questions are reviewed before publication.", "Ask a Local", "/write/question"], ["Review a Place", "Choose a published place, then write a review on its detail page.", "Review", "/local-korea/places"], ["Answer a Question", "Open an approved question to share a helpful answer.", "Help others", "/community/questions"]]);
export const metadata = { title: "Write & contribute", robots: { index: false, follow: false } };
export default async function WritePage() { await requireUser("/write"); return <MvpListingPage eyebrow="Share with the community" title="Write & contribute" description="You’re signed in. Choose a way to help others discover Korea. Questions, answers, and reviews are reviewed before publication; never include private contact or meeting details." cards={cards} />; }
