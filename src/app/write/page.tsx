import { MvpListingPage } from "@/components/mvp-listing-page";
import { makeCards } from "@/lib/mock-content";
const cards = makeCards([["Share a local find", "Recommend a place, food spot, or experience you loved.", "Place", "/write"], ["Write a quick review", "Leave a note that helps someone plan with confidence.", "Review", "/write"], ["Start a conversation", "Ask a question or share a Korea story with the community.", "Post", "/write"]]);
export default function WritePage() { return <MvpListingPage eyebrow="Share with the community" title="Write" description="Choose a simple way to share the places, experiences, and questions that matter to you." filters={["Choose a format", "Place", "Review", "Post"]} cards={cards} />; }
