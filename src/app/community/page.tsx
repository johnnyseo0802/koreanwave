import { MvpListingPage } from "@/components/mvp-listing-page";
import { communityCards } from "@/lib/mock-content";
export default function CommunityPage() { return <MvpListingPage eyebrow="Made for connection" title="Community" description="A welcoming place to ask, share, and find people who love Korea in their own way." filters={["All", "Questions", "Stories", "Reviews"]} cards={communityCards} action={{ label: "Share your story", href: "/write" }} />; }
