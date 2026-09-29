export const postTypes = ["moment", "story", "tip"] as const;
export type PostType = typeof postTypes[number];
export const topics = ["transport", "food", "culture", "shopping", "language", "safety", "other"] as const;
export const reportReasons = ["spam", "harassment", "inappropriate", "personal_information", "copyright", "other"] as const;
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const count = (value: string) => Array.from(value.trim()).length;
export type PostInput = { type: string; title: string; body: string; topic: string; image_id: string; image_alt: string; location_label: string };
export function validatePost(p: PostInput): string | null {
  if (!postTypes.includes(p.type as PostType)) return "Choose a contribution type.";
  if (p.type !== "moment" && (count(p.title) < 2 || count(p.title) > 160)) return "Title must be 2–160 characters.";
  if (count(p.title) > 160) return "Title must be at most 160 characters.";
  const min = p.type === "story" ? 20 : p.type === "tip" ? 10 : 2;
  const max = p.type === "story" ? 10000 : p.type === "tip" ? 5000 : 500;
  if (count(p.body) < min || count(p.body) > max) return `Enter ${min}–${max.toLocaleString("en")} characters, excluding surrounding spaces.`;
  if ((p.type === "tip" && !p.topic) || (p.topic && !topics.includes(p.topic as typeof topics[number]))) return "Choose a valid topic.";
  if ((p.type === "moment" && !p.image_id) || (p.image_id && !uuid.test(p.image_id))) return "Choose and upload a photo.";
  if (count(p.image_alt) > 240 || count(p.location_label) > 120) return "Shorten the photo description (240) or location (120).";
  return null;
}
export type CommunityPost = { id: string; type: string; title: string | null; body: string; image_id: string | null; image_alt: string | null; location_label: string | null; topic: string | null; is_featured: boolean; published_at: string | null; status?: string; created_at?: string };
export const publicPostFields = "id,type,title,body,image_id,image_alt,location_label,topic,is_featured,published_at";
export type ActionResult = { ok: boolean; message: string };
