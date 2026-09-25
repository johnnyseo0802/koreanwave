import { MvpListingPage } from "@/components/mvp-listing-page";
import { communityCards } from "@/lib/navigation-cards";
export const metadata = { title: "Community" };
export default function CommunityPage() { return <MvpListingPage eyebrow="Made for connection" title="Community" description="Ask a question, offer a helpful answer, or share a review of somewhere you visited. Contributions are reviewed before they appear publicly." cards={communityCards} action={{ label: "Contribute", href: "/write" }} />; }
