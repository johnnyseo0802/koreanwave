import { MvpListingPage } from "@/components/mvp-listing-page";
import { localCards } from "@/lib/mock-content";
export default function LocalKoreaPage() { return <MvpListingPage eyebrow="Plan less. Feel more." title="Discover Local Korea" description="Go beyond the guidebook with places, tastes, and experiences that make a visit feel personal." filters={["All", "Places", "Food", "Cafés", "Experiences"]} cards={localCards} action={{ label: "Browse places", href: "/local-korea/places" }} />; }
