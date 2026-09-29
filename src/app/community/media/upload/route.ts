import { createClient } from "@/lib/supabase/server";
import { validateImage } from "@/lib/media";
import { uploadCommunityImage } from "@/lib/supabase/community-media-writer";
import { uuid } from "@/lib/community";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const reply = (body: object, status: number) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ message: "Upload not allowed." }, 403);
  const size = Number(request.headers.get("content-length"));
  if (!size || size > 3 * 1024 * 1024) return reply({ message: "Choose an image at most 2 MiB." }, 413);
  try {
    const client = await createClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return reply({ message: "Please log in before uploading." }, 401);
    const form = await request.formData();
    // Never accept a caller-selected namespace, identity or Storage destination.
    if (["image_id", "id", "owner_id", "path", "bucket"].some(key => form.has(key))) return reply({ message: "Upload not allowed." }, 403);
    const file = form.get("file");
    if (!(file instanceof File) || !await validateImage(file)) return reply({ message: "Choose JPEG, PNG or WebP, at most 2 MiB." }, 400);
    const { data, error } = await client.from("community_uploads").insert({ owner_id: auth.user.id }).select("id").single();
    if (error || !data || !uuid.test(data.id)) return reply({ message: "Upload is currently unavailable." }, 400);
    // Own-only registry SELECT policy re-verifies ownership with the user's session.
    // The privileged writer never performs DB/Auth operations.
    const own = await client.from("community_uploads").select("id").eq("id", data.id).maybeSingle();
    if (own.error || own.data?.id !== data.id) return reply({ message: "Upload not allowed." }, 403);
    const uploaded = await uploadCommunityImage(data.id, Buffer.from(await file.arrayBuffer()));
    if (!uploaded) return reply({ message: "Upload is currently unavailable. Please try again later." }, 503);
    return reply({ image_id: data.id }, 201);
  } catch { return reply({ message: "Could not process this photo. Try a smaller JPEG, PNG or WebP." }, 400); }
}
