import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { MEDIA_BUCKET, validateImage } from "@/lib/media";

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
    const file = form.get("file");
    if (!(file instanceof File)) return reply({ message: "Choose a JPEG, PNG or WebP image." }, 400);
    const extension = await validateImage(file);
    if (!extension) return reply({ message: "Use a valid JPEG, PNG or WebP image, at most 2 MB." }, 400);
    const path = `images/${crypto.randomUUID()}.${extension}`;
    const { error } = await access.client.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
    if (error) return reply({ message: "Upload unavailable. Check that the media migration is applied and try again." }, 400);
    const { data } = access.client.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    return reply({ url: data.publicUrl }, 201);
  } catch { return reply({ message: "Could not upload the image. Please try again." }, 400); }
}
