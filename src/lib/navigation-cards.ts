import type { ContentCardData } from "@/components/content-card";

const tones = ["from-[#f4d8ff] via-[#d8d8ff] to-[#b8d8ff]", "from-[#ffd8c2] via-[#ffbfc9] to-[#f9d8ed]", "from-[#b9e7df] via-[#b9d9e8] to-[#d6d8ff]", "from-[#ffe3ad] via-[#ffd3b8] to-[#ffc8d5]", "from-[#dceee4] via-[#dce8ff] to-[#eadffd]", "from-[#ffe1c7] via-[#f4e5c1] to-[#dceee4]"];

export function makeCards(items: Array<[string, string, string, string]>): ContentCardData[] {
  return items.map(([title, description, meta, href], index) => ({ title, description, meta, href, tone: tones[index % tones.length] }));
}

export const contentCards = makeCards([
  ["Music", "K-Pop sounds, concerts, and communities.", "K-Pop", "/k-contents/music"],
  ["Dramas", "Scenes, stories, and screen locations.", "K-Drama", "/k-contents/dramas"],
  ["Movies", "Korean cinema beyond the credits.", "K-Movie", "/k-contents/movies"],
]);

// Navigation categories, not database records or invented editorial content.
export const localCards = makeCards([
  ["Places", "Neighborhoods, markets, and cafés worth finding.", "Explore", "/local-korea/places"],
  ["Experiences", "Discover cultural activities and visitor information.", "Try it", "/local-korea/experiences"],
  ["Events", "Meet people through upcoming community gatherings.", "Join in", "/events"],
]);

export const communityCards = makeCards([
  ["Ask a Local", "Thoughtful answers from people who know Korea best.", "Questions", "/community/questions"],
  ["Contribute", "Ask a question or share a review of a place you visited.", "Write", "/write"],
  ["Reviews", "Honest recommendations for places worth your time.", "Community", "/community/reviews"],
]);
