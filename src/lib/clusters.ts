export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const clusterFields = "id,slug,title,summary,introduction,status,display_order,published_at";
export const targets = {
  article_id: { table: "editorial_articles", status: "published", fields: "id,title,summary,image_url,image_alt", base: "/articles", label: "Editorial discovery" },
  place_id: { table: "places", status: "published", fields: "id,name,description,image_url,image_alt", base: "/local-korea/places", label: "Places" },
  experience_id: { table: "experiences", status: "published", fields: "id,name,description,image_url,image_alt", base: "/local-korea/experiences", label: "Experiences" },
  event_id: { table: "events", status: "published", fields: "id,title,description,image_url,image_alt", base: "/event", label: "Events" },
  question_id: { table: "questions", status: "approved", fields: "id,title,body", base: "/community/questions", label: "Ask a Local" },
  community_post_id: { table: "community_posts", status: "approved", fields: "id,title,body", base: "/community/posts", label: "Community" },
} as const;
export type Target = keyof typeof targets;
export const isTarget = (value: unknown): value is Target => typeof value === "string" && Object.hasOwn(targets, value);
export type Cluster = { id: string; slug: string; title: string; summary: string; introduction: string; status: string; display_order: number; published_at: string | null; updated_at?: string };
export type Prompt = { id: string; kind: string; prompt: string; display_order: number };
export const promptKinds = ["question", "moment", "story", "tip"] as const;
export const orderValue = (value: unknown) => typeof value === "string" && /^\d{1,4}$/.test(value) ? Number(value) : null;
export function validateCluster(form: FormData) {
  const text = (key: string) => typeof form.get(key) === "string" ? (form.get(key) as string).trim() : "";
  const slug = text("slug"), title = text("title"), summary = text("summary"), introduction = text("introduction"), status = text("status"), display_order = orderValue(text("display_order"));
  if (slug.length < 2 || slug.length > 80 || !slugPattern.test(slug)) return { error: "Use a slug of 2–80 lowercase letters, numbers and single hyphens." };
  for (const [label, value, min, max] of [["Title",title,2,160],["Summary",summary,10,500],["Introduction",introduction,20,10000]] as const) if (Array.from(value).length < min || Array.from(value).length > max) return { error: `${label} must contain ${min}–${max} characters.` };
  if (!["draft","published"].includes(status) || display_order === null) return { error: "Choose a publication state and order from 0 to 9999." };
  return { value: { slug,title,summary,introduction,status,display_order } };
}
