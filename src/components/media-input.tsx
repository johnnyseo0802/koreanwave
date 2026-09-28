"use client";
import { useRef, useState } from "react";
import { ContentImage } from "@/components/content-image";
import { MAX_IMAGE_BYTES } from "@/lib/media";

export function MediaInput({ initialUrl, initialAlt, onBusy }: { initialUrl?: string | null; initialAlt?: string | null; onBusy?: (busy: boolean) => void }) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [alt, setAlt] = useState(initialAlt ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  async function upload(file?: File) {
    if (!file || lock.current) return;
    if (file.size > MAX_IMAGE_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setMessage("Choose JPEG, PNG or WebP, at most 2 MB."); return; }
    lock.current = true; setBusy(true); onBusy?.(true); setMessage("");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/admin/media/upload", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok || typeof result.url !== "string") { setMessage("Upload failed. Check your access and the media setup."); return; }
      setUrl(result.url); setMessage("Uploaded. Save the content to attach this image.");
    } catch { setMessage("Could not confirm the upload. Please try again."); }
    finally { lock.current = false; setBusy(false); onBusy?.(false); }
  }
  return <div className="space-y-3 rounded-2xl border border-[#e3e7e2] p-4">
    <p className="text-sm font-semibold">Public cover image (optional)</p>
    <ContentImage url={url} alt={alt} />
    <input type="hidden" name="image_url" value={url} />
    <label className="block text-sm">{busy ? "Uploading…" : "Upload / replace image"}<input aria-label="Upload cover image" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="mt-2 block w-full min-w-0 text-sm" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} /></label>
    <label className="block text-sm">Describe the image for accessibility<input name="image_alt" maxLength={240} value={alt} onChange={e => setAlt(e.target.value)} className="mt-2 w-full rounded-xl border border-[#dce2dc] px-3 py-2" /></label>
    {url && <button type="button" disabled={busy} onClick={() => { setUrl(""); setAlt(""); setMessage("Image detached. Save to apply. The stored file is retained safely."); }} className="text-sm underline">Remove image from content</button>}
    <p className="text-xs leading-5 text-[#69736c]">JPEG / PNG / WebP · 2 MB maximum · 16:9 recommended. Only upload images you may publish publicly, even on drafts. No personal or private meeting information. Replaced files are retained; no automatic deletion of shared media.</p>
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
