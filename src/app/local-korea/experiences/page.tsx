import { MvpListingPage } from "@/components/mvp-listing-page";
import { makeCards } from "@/lib/mock-content";
const cards = makeCards([["Pottery afternoon", "Make a small object with a local studio.", "Workshop", "/local-korea/experiences"], ["A market cooking table", "Taste and cook familiar Korean dishes together.", "Food experience", "/local-korea/experiences"], ["Night walk in Seoul", "See the city after the busiest hours.", "Walking", "/local-korea/experiences"]]);
export default function ExperiencesPage() { return <MvpListingPage eyebrow="Local Korea / Experiences" title="Experiences" description="Make memories with hands-on, social, and quietly local things to do." filters={["All", "Workshops", "Food", "Outdoors", "Wellness"]} cards={cards} />; }
