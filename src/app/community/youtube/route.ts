import { createClient } from "@/lib/supabase/server";
import { parseYouTube } from "@/lib/youtube";
import { youtubeMetadata } from "@/lib/youtube-metadata";
// Best-effort per-instance abuse guard; not a distributed quota.
const attempts = new Map<string, number>();
export async function POST(request: Request) {
  const reply = (body: object, status: number) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ message: "Request not allowed." }, 403);
  try {
    const client = await createClient(); const { data, error } = await client.auth.getUser();
    if (error || !data.user) return reply({ message: "Please log in again." }, 401);
    const now = Date.now();
    for (const [key, time] of attempts) if (now - time > 10000) attempts.delete(key);
    if (attempts.has(data.user.id) || attempts.size >= 1000) return reply({ message: "Please wait before previewing again." }, 429);
    attempts.set(data.user.id, now);
    if (!request.body) return reply({ message: "Enter a YouTube URL." }, 400);
    const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 4096) { await reader.cancel(); return reply({ message: "URL is too long." }, 400); } chunks.push(part.value); } } finally { reader.releaseLock(); }
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const id = typeof input?.url === "string" ? parseYouTube(input.url) : null;
    const video = id ? await youtubeMetadata(id) : null;
    return video ? reply(video, 200) : reply({ message: "This video could not be previewed. Check its public availability." }, 400);
  } catch { return reply({ message: "Video preview is unavailable." }, 400); }
}
