import "server-only";
import { youtubeId } from "./youtube";
export async function youtubeMetadata(id: string) {
  if (!youtubeId.test(id)) return null;
  try {
    const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, { signal: AbortSignal.timeout(5000), redirect: "error", cache: "no-store" });
    if (!response.ok || !response.body) return null;
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const r = await reader.read(); if (r.done) break; size += r.value.length; if (size > 32768) { await reader.cancel(); return null; } chunks.push(r.value); } } finally { reader.releaseLock(); }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (data.provider_name !== "YouTube" || typeof data.title !== "string" || typeof data.author_name !== "string") return null;
    const title = Array.from(data.title.trim()).slice(0, 300).join("");
    const channel = Array.from(data.author_name.trim()).slice(0, 200).join("");
    return title && channel ? { id, title, channel } : null;
  } catch { return null; }
}
