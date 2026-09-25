export const editorialCategories = {
  "k-contents": { music: "Music", dramas: "Dramas", movies: "Movies" },
  "k-trends": { beauty: "Beauty", fashion: "Fashion", food: "Food" },
} as const;
export type EditorialSection = keyof typeof editorialCategories;
export type EditorialInput = {
  section: EditorialSection; category: string; title: string; summary: string; body: string;
  image_url: string | null; source_url: string | null; status: "draft" | "published";
};
export type PublicArticle = Omit<EditorialInput, "status"> & { id: string; published_at: string | null };
export type ArticleCard = Pick<PublicArticle, "id" | "section" | "category" | "title" | "summary" | "image_url" | "published_at">;
export type AdminArticle = PublicArticle & { status: "draft" | "published"; updated_at: string };
export const publicArticleFields = "id,section,category,title,summary,body,image_url,source_url,published_at";
export const adminArticleFields = `${publicArticleFields},status,updated_at`;
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const sectionLabel = (section: EditorialSection) => section === "k-contents" ? "K-Contents" : "K-Trends";
export const textLength = (text: string) => Array.from(text).length;

// Browser-direct images only: no image proxy/optimizer or server-side URL fetch.
// Require public DNS-style HTTPS hosts, no credentials, ports or local IP literals.
export function safeEditorialUrl(value: string | null | undefined): string | null {
  if (!value || value.length > 2048 || /[\s\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port
      || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)
      || /(?:^|\.)(?:localhost|local|internal|test|invalid|example|home|lan)$/.test(host)) return null;
    return url.href;
  } catch { return null; }
}

export function validateEditorial(form: FormData): { value?: EditorialInput; error?: string } {
  const read = (key: string) => typeof form.get(key) === "string" ? (form.get(key) as string).trim() : "";
  const section = read("section");
  const category = read("category");
  if ((section !== "k-contents" && section !== "k-trends")
    || !Object.hasOwn(editorialCategories[section], category)) return { error: "Choose a valid section and category." };
  const title = read("title"), summary = read("summary"), body = read("body");
  for (const [label, value, min, max] of [["Title", title, 2, 160], ["Summary", summary, 10, 500], ["Body", body, 20, 30000]] as const) {
    if (textLength(value) < min || textLength(value) > max) return { error: `${label} must contain ${min}–${max} characters after trimming.` };
  }
  const status = read("status");
  if (status !== "draft" && status !== "published") return { error: "Choose Save draft or Publish." };
  const image = read("image_url"), source = read("source_url");
  if ((image && !safeEditorialUrl(image)) || (source && !safeEditorialUrl(source))) return { error: "Use a valid public HTTPS URL without credentials for image and source links." };
  return { value: { section, category, title, summary, body, status, image_url: image || null, source_url: source || null } };
}
