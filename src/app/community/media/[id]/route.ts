import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/community";
import { cleanCommunityImage } from "@/lib/community-image";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const missing = () => new Response("Not found", { status: 404, headers });
  if (!uuid.test(id)) return missing();
  try {
    const client = await createClient();
    // Private Storage RLS decides approved/owner/admin. No signed URL or CDN cache.
    const { data, error } = await client.storage.from("community-media").download(`${id}/image.webp`);
    if (error || !data) return missing();
    const bytes = await cleanCommunityImage(Buffer.from(await data.arrayBuffer()));
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/webp" } });
  } catch { return missing(); }
}
