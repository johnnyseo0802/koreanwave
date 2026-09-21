import { MvpListingPage } from "@/components/mvp-listing-page";
import { makeCards } from "@/lib/mock-content";
const cards = makeCards([["Seoul sound map", "A first listen to music neighborhoods around the city.", "Playlist", "/k-contents/music"], ["Beyond the stage", "Small venues and the stories behind a great night out.", "Local guide", "/k-contents/music"], ["Fan-friendly Seoul", "Easy places to meet, browse, and make a day of it.", "Community", "/k-contents/music"]]);
export default function MusicPage() { return <MvpListingPage eyebrow="K-Contents / Music" title="Music & K-Pop" description="Find the energy, communities, and real-world places around Korea’s global sound." filters={["Featured", "Concerts", "Playlists", "Fandom"]} cards={cards} />; }
