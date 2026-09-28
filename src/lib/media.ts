export const MEDIA_BUCKET = "site-media";
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const mediaPathPattern = /^images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function mediaOrigin(): string | null {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return url.protocol === "https:" && /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) && !url.port && !url.username && !url.password ? url.origin : null;
  } catch { return null; }
}
export function safeMediaUrl(value: string | null | undefined): string | null {
  if (!value || value.length > 2048 || /[\\\s%?#]/.test(value) || value.includes("/../") || value.includes("/./")) return null;
  try {
    const url = new URL(value);
    const prefix = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
    if (url.origin !== mediaOrigin() || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(prefix)) return null;
    return mediaPathPattern.test(url.pathname.slice(prefix.length)) ? url.href : null;
  } catch { return null; }
}
export async function validateImage(file: File): Promise<string | null> {
  if (!file.size || file.size > MAX_IMAGE_BYTES) return null;
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/jpeg" && b[0] === 255 && b[1] === 216 && b[2] === 255) return "jpg";
  if (file.type === "image/png" && [137,80,78,71,13,10,26,10].every((v,i) => b[i] === v)) return "png";
  if (file.type === "image/webp" && String.fromCharCode(...b.slice(0,4)) === "RIFF" && String.fromCharCode(...b.slice(8,12)) === "WEBP") return "webp";
  return null;
}
