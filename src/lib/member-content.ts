import { publicationDisclosure } from "@/lib/publication-policy";
import { count, topics, validatePost, uuid } from "@/lib/community";
export const contentKinds = ["post", "question", "answer", "review", "comment"] as const;
export type ContentKind = typeof contentKinds[number];
export type OwnedContent = {
  commercial_disclosure?: string; review_reason?: string;
  id: string; kind: ContentKind; type?: string; title?: string | null; body: string;
  status: string; revision: string | number; created_at: string; published_at?: string | null; edited_at?: string | null;
  image_id?: string | null; image_alt?: string | null; location_label?: string | null; topic?: string | null;
  youtube_video_id?: string | null; youtube_title?: string | null; youtube_channel_name?: string | null;
  post_id?: string; parent_comment_id?: string | null; question_id?: string; place_id?: string; is_featured?: boolean;
};
export const validKind = (value: string): value is ContentKind => contentKinds.includes(value as ContentKind);
export const validRevision = (value: string) => /^[1-9][0-9]{0,14}$/.test(value);
export function contentHref(p: OwnedContent) {
  if (p.kind === "question") return `/community/questions/${p.id}`;
  if (p.kind === "answer") return `/community/questions/${p.question_id}`;
  if (p.kind === "review") return `/local-korea/places/${p.place_id}`;
  return `/community/posts/${p.kind === "comment" ? p.post_id : p.id}`;
}
export function editInput(p: OwnedContent, form: FormData) {
  const text = (key: string) => { const v = form.get(key); return typeof v === "string" ? v.trim() : ""; };
  const body = text("body"), title = text("title");
  const patch: Record<string, string | null> = { body, commercial_disclosure: publicationDisclosure(form) };
  let error: string | null = null;
  if (p.kind === "post") {
    if(p.type==="discussion") {
      patch.title=title;
      error=count(title)<2||count(title)>160||count(body)<2||count(body)>2000?"Use a title of 2–160 and body of 2–2,000 characters.":null;
      return {patch,error};
    }
    const values = { type: p.type ?? "", title, body, topic: text("topic"), image_id: text("image_id"), image_alt: text("image_alt"), location_label: text("location_label"), youtube_video_id: text("youtube_video_id") };
    error = validatePost(values);
    for (const key of ["title", "topic", "image_id", "image_alt", "location_label", "youtube_video_id"] as const) patch[key] = values[key] || null;
    if (patch.youtube_video_id) patch.image_alt=null;
    if (patch.image_id && !uuid.test(patch.image_id)) error="Choose a valid uploaded photo.";
    if (patch.topic && !topics.includes(patch.topic as typeof topics[number])) error="Choose a valid topic.";
  } else {
    const min = p.kind === "question" ? 10 : 2, max = p.kind === "comment" ? 2000 : 5000;
    if (count(body)<min || count(body)>max) error=`Body must be ${min}–${max} characters.`;
    if (p.kind === "question") { patch.title=title; if(count(title)<5 || count(title)>160) error="Title must be 5–160 characters."; }
  }
  return { patch, error };
}
