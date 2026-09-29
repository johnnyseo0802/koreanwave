import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cleanCommunityImage } from "@/lib/community-image";
import { uuid } from "@/lib/community";

/** Storage-only boundary. Caller must verify Auth and own registry via cookie RLS.
 * Never export the elevated client, accept bucket/path overrides, or use cookies.
 * Secret keys have project-wide privilege; this wrapper is an application boundary,
 * not a claim that Supabase scopes the credential to one bucket.
 */
export async function uploadCommunityImage(imageId: string, input: Buffer): Promise<boolean> {
  if (!uuid.test(imageId)) return false;
  // Decode and sanitize BEFORE creating the privileged client. Original never stored.
  const webp = await cleanCommunityImage(input);
  const secret = process.env.SUPABASE_COMMUNITY_MEDIA_SECRET_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret?.startsWith("sb_secret_") || !url) return false;
  const client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.storage.from("community-media").upload(
    `${imageId}/image.webp`, webp,
    { contentType: "image/webp", upsert: false, cacheControl: "0" },
  );
  return !error;
}
