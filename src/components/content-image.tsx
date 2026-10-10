"use client";
import Image from "next/image";
import { useState } from "react";
import { safeMediaUrl } from "@/lib/media";

export function ContentImage({ url, alt = "", sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" }: { url?: string | null; alt?: string | null; sizes?: string }) {
  const src = safeMediaUrl(url);
  const [failed, setFailed] = useState<string | null>(null);
  return <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-[#eeede6]">
    {src && failed !== src ? <Image src={src} alt={alt ?? ""} fill sizes={sizes} className="object-cover" onError={() => setFailed(src)} /> : <div aria-hidden="true" className="groov-image-fallback"><span className="groov-fallback-ring" /><span className="relative text-xs font-semibold tracking-[0.18em]">KGROOV / DISCOVER</span><span className="relative text-3xl font-bold tracking-tight">Find your groove.</span></div>}
  </div>;
}
