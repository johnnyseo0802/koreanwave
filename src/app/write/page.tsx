import { MvpListingPage } from "@/components/mvp-listing-page";
import { makeCards } from "@/lib/navigation-cards";
import { requireUser } from "@/lib/auth/require-user";
const cards = makeCards([["Korea Moment", "A photo and a few words.", "Moment", "/write/moment"], ["Korea Story", "Tell us about your Korea experience.", "Story", "/write/story"], ["Korea Tip", "Help someone discover Korea.", "Tip", "/write/tip"], ["Ask a Question", "Ask people who know Korea.", "Ask a Local", "/write/question"], ["Write a Review", "Share your experience at a place.", "Review", "/local-korea/places"]]);
export const metadata = { title: "Write & contribute", robots: { index: false, follow: false } };
export default async function WritePage() { await requireUser("/write"); return <MvpListingPage eyebrow="Share with the community" title="Share something about Korea" description="You’re signed in. Choose a way to help others discover Korea. Contributions are reviewed before publication; never include private contact or meeting details." cards={cards} />; }
