"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveArticle } from "@/app/admin/content/actions";
import { editorialCategories, sectionLabel, textLength, validateEditorial, type AdminArticle, type EditorialSection } from "@/lib/editorial";

export function EditorialForm({ article }: { article?: AdminArticle }) {
  const router = useRouter();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<EditorialSection>(article?.section ?? "k-contents");
  const [category, setCategory] = useState(article?.category ?? "music");
  const [body, setBody] = useState(article?.body ?? "");
  const [id, setId] = useState(article?.id ?? null);
  const [revision, setRevision] = useState(article?.updated_at ?? null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const inputClass = "mt-2 w-full rounded-xl border border-[#dce2dc] bg-white px-4 py-3 font-normal text-[#18201d]";

  async function submit(form: FormData) {
    if (lock.current) return;
    setFeedback(null);
    const checked = validateEditorial(form);
    if (!checked.value) { setFeedback({ ok: false, message: checked.error ?? "Check your fields." }); return; }
    lock.current = true;
    setBusy(true);
    try {
      const result = await saveArticle(id, revision, form);
      setFeedback(result);
      if (result.ok && result.id && result.revision) {
        setId(result.id);
        setRevision(result.revision);
        // Keep the saved identity locally before navigation; repeated saves UPDATE.
        if (!id) router.replace(`/admin/content/${result.id}?saved=${checked.value.status}`);
        else router.refresh();
      }
    } catch { setFeedback({ ok: false, message: "We couldn’t confirm the save. Check the content list before retrying." }); }
    finally { lock.current = false; setBusy(false); }
  }

  return <form onSubmit={event => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const form = new FormData(event.currentTarget);
    if (submitter instanceof HTMLButtonElement) form.set("status", submitter.value);
    void submit(form);
  }} className="mt-8 rounded-[2rem] border border-[#e3e7e2] bg-white p-6 sm:p-8">
    <p className="mb-6 text-sm leading-6 text-[#69736c]">Write in English using plain text. Save a draft before previewing. Publishing makes the article visible immediately; saving as draft removes it from public pages.</p>
    <fieldset disabled={busy} className="space-y-6 disabled:opacity-60">
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block text-sm font-semibold">Section<select name="section" className={inputClass} value={section} onChange={e => { const next = e.target.value as EditorialSection; setSection(next); setCategory(next === "k-contents" ? "music" : "beauty"); }}>
          {Object.keys(editorialCategories).map(key => <option key={key} value={key}>{sectionLabel(key as EditorialSection)}</option>)}
        </select></label>
        <label className="block text-sm font-semibold">Category<select name="category" className={inputClass} value={category} onChange={e => setCategory(e.target.value)}>
          {Object.entries(editorialCategories[section]).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </div>
      <label className="block text-sm font-semibold">Title (2–160 characters)<input name="title" required defaultValue={article?.title} className={inputClass} /></label>
      <label className="block text-sm font-semibold">Summary (10–500 characters)<textarea name="summary" required rows={3} defaultValue={article?.summary} className={inputClass} /></label>
      <label className="block text-sm font-semibold">Body (20–30,000 characters)<textarea name="body" required rows={16} value={body} onChange={e => setBody(e.target.value)} className={inputClass} /><span className="mt-1 block font-normal text-[#69736c]">{textLength(body.trim()).toLocaleString("en")} / 30,000 · Plain text, no HTML</span></label>
      <label className="block text-sm font-semibold">Image URL (optional)<input name="image_url" type="url" maxLength={2048} defaultValue={article?.image_url ?? ""} placeholder="https://" className={inputClass} /><span className="mt-1 block font-normal text-[#69736c]">Use a public HTTPS image you have permission to publish. Visitors load it directly from that host.</span></label>
      <label className="block text-sm font-semibold">Source / attribution URL (optional)<input name="source_url" type="url" maxLength={2048} defaultValue={article?.source_url ?? ""} placeholder="https://" className={inputClass} /></label>
      <div className="flex flex-wrap gap-3">
        <button disabled={busy} name="status" value="draft" className="rounded-full border border-[#dce2dc] px-5 py-3 text-sm font-semibold">{busy ? "Saving…" : article?.status === "published" ? "Return to draft" : "Save draft"}</button>
        <button disabled={busy} name="status" value="published" className="rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white">{busy ? "Saving…" : "Publish / save published"}</button>
      </div>
    </fieldset>
    {feedback && <p role={feedback.ok ? "status" : "alert"} className={`mt-6 rounded-xl p-4 text-sm ${feedback.ok ? "bg-[#eef5e7]" : "bg-[#fff0ea]"}`}>{feedback.message}</p>}
    {id && <Link href={`/admin/content/${id}/preview`} className="mt-6 inline-block text-sm font-semibold underline">Preview saved version →</Link>}
  </form>;
}
