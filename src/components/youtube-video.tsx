"use client";
import Image from "next/image";
import { useState } from "react";
import { youtubeId } from "@/lib/youtube";
export function YouTubeVideo({ id, title, channel, thumbnail = false }: { id: string; title?: string | null; channel?: string | null; thumbnail?: boolean }) {
  const [playing, setPlaying] = useState(false); const [failed, setFailed] = useState(false);
  if (!youtubeId.test(id)) return null;
  return <div className="min-w-0 space-y-2">
    {playing && !thumbnail ? <iframe className="aspect-video w-full rounded-xl border-0" src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=0`} title={title || "YouTube video"} referrerPolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen /> : <div className="relative aspect-video overflow-hidden rounded-xl bg-[#171717] text-white">{!failed && <Image unoptimized src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt={title || "YouTube video thumbnail"} width={480} height={360} onError={() => setFailed(true)} className="h-full w-full object-cover" />}{!thumbnail && <button type="button" onClick={() => setPlaying(true)} className="absolute inset-0 flex items-center justify-center bg-black/20 font-semibold">Load YouTube player</button>}{failed && <span className="absolute bottom-2 left-2">YouTube video</span>}</div>}
    {title && <p className="break-words font-semibold">{title}</p>}{channel && <p className="break-words text-sm">{channel}</p>}
    {!thumbnail && <p className="text-sm">Playback may be unavailable if the video is removed, private or restricted. Loading the player connects to YouTube. <a className="underline" href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer">Watch on YouTube</a></p>}
  </div>;
}
