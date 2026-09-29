"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { submitCommunityPost } from "@/app/community/actions";
import { count, topics, validatePost, type PostType } from "@/lib/community";
const input = "mt-2 block w-full rounded-xl border border-[#ccd2cb] bg-white p-3";
export function CommunityPostForm({ type, prompt }: { type: PostType; prompt?: string }) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const uploaded = useRef("");
  useEffect(() => { return () => { if (preview) URL.revokeObjectURL(preview); }; }, [preview]);
  if (done) return <div role="status" className="rounded-2xl bg-[#edf3e5] p-7">{message}<Link href="/account/contributions" className="mt-3 block py-3 font-semibold underline">Check My Contributions →</Link></div>;
  const max = type === "moment" ? 500 : type === "tip" ? 5000 : 10000;
  return <form className="max-w-2xl space-y-6 rounded-2xl border border-[#e3e7e2] bg-white p-6 sm:p-8" onSubmit={async event => {
    event.preventDefault(); if (lock.current) return;
    const form = new FormData(event.currentTarget);
    const values = { type, title: String(form.get("title") ?? ""), body, topic: String(form.get("topic") ?? ""), image_id: file ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" : "", image_alt: String(form.get("image_alt") ?? ""), location_label: String(form.get("location_label") ?? "") };
    const error = validatePost(values); if (error) { setMessage(error); return; }
    lock.current = true; setBusy(true); setMessage("Uploading and submitting…");
    try {
      if (file && !uploaded.current) {
        const upload = new FormData(); upload.set("file", file);
        const response = await fetch("/community/media/upload", { method: "POST", body: upload });
        const result = await response.json();
        if (!response.ok || !result.image_id) { setMessage("Could not upload the photo. Use JPEG, PNG or WebP, at most 2 MiB, and check that you’re signed in."); return; }
        uploaded.current = result.image_id;
      }
      form.set("type", type); form.set("image_id", uploaded.current); form.set("body", body);
      const result = await submitCommunityPost(form); setMessage(result.message); setDone(result.ok);
    } catch { setMessage("We couldn’t confirm your submission. Check My Contributions before trying again."); }
    finally { lock.current = false; setBusy(false); }
  }}>
    {prompt && <p className="rounded-xl bg-[#f4f7f0] p-4">Writing inspiration: {prompt}</p>}
    {type === "story" && <details><summary className="cursor-pointer py-3 font-semibold">Need a little inspiration?</summary><ul className="list-inside list-disc space-y-2 text-sm">{["My first day in Korea","Something that surprised me","My favorite neighborhood","A mistake I made in Korea","A Korean experience I’ll never forget","My K-pop trip"].map(p => <li key={p}>{p}</li>)}</ul></details>}
    {type !== "moment" && <label className="block">Title<input name="title" required maxLength={160} aria-describedby="post-feedback" className={input} disabled={busy} /></label>}
    <label className="block">{type === "moment" ? "Caption" : "Your experience"}<textarea name="body" required rows={type === "moment" ? 4 : 9} value={body} onChange={e => setBody(e.target.value)} aria-describedby="body-count post-feedback" className={input} disabled={busy} /></label><p id="body-count" className="text-sm">{count(body)} / {max.toLocaleString("en")} characters</p>
    <label className="block">Photo {type !== "moment" && "(optional)"}<input type="file" accept="image/jpeg,image/png,image/webp" required={type === "moment"} disabled={busy} className={`${input} max-w-full text-sm`} onChange={e => { uploaded.current = ""; const selected = e.target.files?.[0]; setPreview(""); if (selected && selected.size <= 2097152 && ["image/jpeg","image/png","image/webp"].includes(selected.type)) { setFile(selected); setPreview(URL.createObjectURL(selected)); setMessage(""); } else { setFile(null); e.target.value = ""; setMessage("Choose JPEG, PNG or WebP, at most 2 MiB."); } }} /></label><p className="text-sm text-[#626c66]">JPEG, PNG or WebP · maximum 2 MiB. Upload only photos you have permission to share. Avoid faces, contact details and exact private locations. Photos remain private until approval.</p>
    {preview && <Image unoptimized src={preview} alt="Your selected photo preview" width={600} height={450} className="max-h-80 w-full rounded-xl object-contain" />}
    <label className="block">Photo description (optional)<input name="image_alt" maxLength={240} disabled={busy} className={input} /></label>
    {type === "moment" && <label className="block">Broad location (optional)<input name="location_label" maxLength={120} placeholder="e.g. Seongsu, Seoul" disabled={busy} className={input} /></label>}
    <label className="block">Topic {type !== "tip" && "(optional)"}<select name="topic" required={type === "tip"} aria-describedby="post-feedback" className={input} disabled={busy}><option value="">Choose a topic</option>{topics.map(t => <option key={t} value={t}>{t[0].toUpperCase()+t.slice(1)}</option>)}</select></label>
    <p id="post-feedback" role="status" aria-live="polite">{message}</p><button disabled={busy} className="rounded-full bg-[#17201d] px-6 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Sharing…" : "Submit for review"}</button><p className="text-sm text-[#626c66]">Published posts cannot be edited in this MVP. Check your text and photo before sharing.</p>
  </form>;
}
