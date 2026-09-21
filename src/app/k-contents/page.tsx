import { MvpListingPage } from "@/components/mvp-listing-page";
import { contentCards } from "@/lib/mock-content";
export default function KContentsPage() { return <MvpListingPage eyebrow="Culture, curated" title="K-Contents" description="Explore the sounds, stories, and screen moments that lead people toward Korea." filters={["All", "Music", "Dramas", "Movies"]} cards={contentCards} />; }
