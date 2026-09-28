"use client";
import Image from "next/image";
import { useState } from "react";
import { safeMediaUrl } from "@/lib/media";

export function ContentImage({ url, alt = "", sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" }: { url?: string | null; alt?: string | null; sizes?: string }) {
  const src = safeMediaUrl(url);
  const [failed, setFailed] = useState<string | null>(null);
  return <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#dceee4] via-[#e5ead9] to-[#eadfcf]">
    {src && failed !== src ? <Image src={src} alt={alt ?? ""} fill sizes={sizes} className="object-cover" onError={() => setFailed(src)} /> : <span aria-hidden="true" className="absolute bottom-4 left-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#557b39]">Korean Wave / Discover</span>}
  </div>;
}
