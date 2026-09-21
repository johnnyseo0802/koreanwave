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

export const localCards = makeCards([
  ["Places", "Neighborhoods and local favorites worth finding.", "Explore", "/local-korea/places"],
  ["Food", "Markets, meals, and comfort-food rituals.", "Places category", "/local-korea/places"],
  ["Cafés", "Slow mornings and the city’s best views.", "Places category", "/local-korea/places"],
  ["Experiences", "Make a memory that feels truly local.", "Try it", "/local-korea/experiences"],
]);

export const communityCards = makeCards([
  ["Ask a Local", "Thoughtful answers from people who know Korea best.", "Questions", "/community/questions"],
  ["Share Your Experience", "Help the next traveler with your real stories.", "Write", "/write"],
  ["Reviews", "Honest recommendations for places worth your time.", "Community", "/community/reviews"],
]);
