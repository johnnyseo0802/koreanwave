import { MvpListingPage } from "@/components/mvp-listing-page";
import { makeCards } from "@/lib/mock-content";
const cards = makeCards([["Scenes in Seoul", "A gentle guide to favorite drama backdrops.", "Locations", "/k-contents/dramas"], ["Weekend watchlist", "Three Korean dramas for a slow afternoon.", "Watchlist", "/k-contents/dramas"], ["Stories that travel", "How a local street becomes a global memory.", "Feature", "/k-contents/dramas"]]);
export default function DramasPage() { return <MvpListingPage eyebrow="K-Contents / Dramas" title="K-Drama" description="Follow memorable stories from the screen into the neighborhoods that inspired them." filters={["Featured", "Locations", "Watchlist", "Behind the scenes"]} cards={cards} />; }
