import sharp from "sharp";
import { MAX_IMAGE_BYTES } from "@/lib/media";
// Decode with a pixel budget and re-encode without keepMetadata/withMetadata.
// EXIF orientation is applied before metadata is discarded. No SVG or animation.
export async function cleanCommunityImage(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("Invalid image");
  const image = sharp(bytes, { limitInputPixels: 40000000, animated: false });
  const meta = await image.metadata();
  if (!["jpeg","png","webp"].includes(meta.format ?? "") || (meta.pages ?? 1) > 1) throw new Error("Invalid image");
  const output = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  if (output.length > MAX_IMAGE_BYTES) throw new Error("Invalid image");
  return output;
}
