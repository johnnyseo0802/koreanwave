import { MvpListingPage } from "@/components/mvp-listing-page";
import { makeCards } from "@/lib/mock-content";
const cards = makeCards([["The cafe I returned to", "A calm neighborhood place with thoughtful coffee.", "Seoul · 4.9", "/community/reviews"], ["A weekend food market", "Easy to navigate, delicious, and worth arriving early.", "Busan · 4.7", "/community/reviews"], ["A small local workshop", "Friendly hosts and a beautiful thing to take home.", "Jeonju · 5.0", "/community/reviews"]]);
export default function ReviewsPage() { return <MvpListingPage eyebrow="Community / Reviews" title="Reviews" description="Real notes from people who have been there, tried it, and want to help." filters={["Latest", "Places", "Food", "Experiences"]} cards={cards} />; }
