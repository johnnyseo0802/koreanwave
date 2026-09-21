import { MvpListingPage } from "@/components/mvp-listing-page";
import { makeCards } from "@/lib/mock-content";
const cards = makeCards([["A gentle beauty reset", "The small rituals people are sharing this week.", "Beauty", "/k-trends"], ["Seoul street layers", "A practical look at current everyday style.", "Fashion", "/k-trends"], ["The comfort food edit", "Warm, simple dishes for a changing season.", "Food", "/k-trends"], ["Slow city weekends", "Small habits making Seoul feel more livable.", "Lifestyle", "/k-trends"]]);
export default function TrendsPage() { return <MvpListingPage eyebrow="Now in Korea" title="K-Trends" description="The beauty, fashion, food, and lifestyle moments people are sharing now." filters={["All", "Beauty", "Fashion", "Food", "Lifestyle"]} cards={cards} />; }
