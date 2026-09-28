import { textLength } from "@/lib/editorial";
import { safeMediaUrl } from "@/lib/media";
export type ManagedKind = "places" | "experiences" | "events";
export function managedKind(value: unknown): value is ManagedKind { return value === "places" || value === "experiences" || value === "events"; }
export const managedFields = {
  places: ["name", "area", "category", "description", "visitor_info"],
  experiences: ["name", "area", "category", "description", "visitor_info"],
  events: ["title", "public_area", "category", "description", "participation_info", "cancellation_policy"],
} as const;
export type ManagedRecord = { id: string; updated_at: string; status: string; image_url: string | null; image_alt: string | null; [key: string]: string | null };
export function validateManaged(kind: ManagedKind, form: FormData): { value?: Record<string, string | null>; error?: string } {
  const value: Record<string, string | null> = {};
  for (const field of managedFields[kind]) {
    const raw = form.get(field);
    const text = typeof raw === "string" ? raw.trim() : "";
    const optional = ["visitor_info", "participation_info", "cancellation_policy"].includes(field);
    const min = optional ? 0 : field === "description" ? 10 : 2;
    const max = optional ? 5000 : field === "description" ? 10000 : field === "category" ? 80 : field === "public_area" ? 200 : 160;
    if (textLength(text) < min || textLength(text) > max) return { error: `${field.replaceAll("_", " ")} must contain ${min}–${max} characters.` };
    value[field] = text || null;
  }
  const status = form.get("status");
  if (status !== "draft" && status !== "published") return { error: "Choose draft or published." };
  const image = form.get("image_url"), alt = form.get("image_alt");
  if (typeof image !== "string" || (image && !safeMediaUrl(image))) return { error: "Upload a site-media image, or remove the image." };
  if (typeof alt !== "string" || textLength(alt) > 240) return { error: "Keep the image description within 240 characters." };
  if (image && !alt.trim()) return { error: "Describe the image before saving." };
  return { value: { ...value, status, image_url: image || null, image_alt: alt.trim() || null } };
}
