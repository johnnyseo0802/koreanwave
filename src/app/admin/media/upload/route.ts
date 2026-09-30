import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { MEDIA_BUCKET, validateImage } from "@/lib/media";
import { cleanCommunityImage } from "@/lib/community-image";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const reply = (data: object, status: number) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
  // Same-origin browser uploads only; verify before reading potentially large bodies.
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ message: "Upload not allowed." }, 403);
  const access = await getAdminAccess();
  if (access.status !== "admin") return reply({ message: "Administrator access required." }, 403);
  const length = Number(request.headers.get("content-length"));
  if (!length || length > 3 * 1024 * 1024) return reply({ message: "Choose an image under 2 MB." }, 413);
  try {
    const form = await request.formData();
    if (["bucket", "path", "id", "owner_id"].some(key => form.has(key))) return reply({ message: "Upload destination is server controlled." }, 400);
    const file = form.get("file");
    if (!(file instanceof File)) return reply({ message: "Choose a JPEG, PNG or WebP image." }, 400);
    const extension = await validateImage(file);
    if (!extension) return reply({ message: "Use a valid JPEG, PNG or WebP image, at most 2 MB." }, 400);
    // Same sanitizer as community uploads; admin session/RLS, no privileged key.
    // Decode before Storage access. Never retain the original or its metadata.
    const sanitized = await cleanCommunityImage(Buffer.from(await file.arrayBuffer()));
    const path = `images/${crypto.randomUUID()}.webp`;
    const { error } = await access.client.storage.from(MEDIA_BUCKET).upload(path, sanitized, { contentType: "image/webp", upsert: false, cacheControl: "3600" });
    if (error) return reply({ message: "Upload unavailable. Check that the media migration is applied and try again." }, 400);
    const { data } = access.client.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    return reply({ url: data.publicUrl }, 201);
  } catch { return reply({ message: "Could not upload the image. Please try again." }, 400); }
}
