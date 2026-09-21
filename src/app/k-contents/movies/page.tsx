import { MvpListingPage } from "@/components/mvp-listing-page";
import { makeCards } from "@/lib/mock-content";
const cards = makeCards([["A city on film", "Korean cinema through Seoul’s everyday edges.", "Film guide", "/k-contents/movies"], ["Independent Seoul", "Small theaters and stories worth seeing in person.", "Local guide", "/k-contents/movies"], ["After the credits", "A starter list for exploring Korean film.", "Watchlist", "/k-contents/movies"]]);
export default function MoviesPage() { return <MvpListingPage eyebrow="K-Contents / Movies" title="K-Movie" description="Discover Korean cinema, its creative voices, and places where film culture feels alive." filters={["Featured", "Classics", "Independent", "Theaters"]} cards={cards} />; }
