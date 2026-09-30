"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MediaInput } from "@/components/media-input";
import { managedFields, validateManaged, type ManagedKind, type ManagedRecord } from "@/lib/managed-content";
import { saveManaged, createManaged } from "@/app/admin/local-content/actions";
export function ManagedContentForm({ kind, item, create = false }: { kind: ManagedKind; item: ManagedRecord; create?: boolean }) {
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false);
  const [revision, setRevision] = useState(item.updated_at);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const lock = useRef(false); const router = useRouter();
  return <form className="mt-8 space-y-6 rounded-2xl border border-[#e3e7e2] bg-white p-5 sm:p-8" onSubmit={async e => {
    e.preventDefault(); if (lock.current || uploading) return;
    const form = new FormData(e.currentTarget);
    const checked = validateManaged(kind, form);
    if (!checked.value) { setFeedback({ ok: false, message: checked.error ?? "Check your fields." }); return; }
    lock.current = true; setBusy(true);
    try { const result = create ? await createManaged(kind, form) : await saveManaged(kind, item.id, revision, form); setFeedback(result); if (result.ok && result.revision) { setRevision(result.revision); if (create && "id" in result) router.replace(`/admin/local-content/${kind}/${result.id}`); router.refresh(); } }
    catch { setFeedback({ ok: false, message: "Could not confirm the save. Reload to check." }); }
    finally { lock.current = false; setBusy(false); }
  }}>
    <p className="text-sm leading-6 text-[#69736c]">Public editorial content only. Keep exact meeting instructions and personal information out of all fields and images. Unpublishing hides related public content; coordinate changes with moderation.</p>
    {kind === "events" && <p className="text-sm">Schedule and private meeting details are managed separately. This editor does not change applications or event dates.</p>}
    <fieldset disabled={busy} className="space-y-5">
      {managedFields[kind].map(field => <label key={field} className="block text-sm font-semibold capitalize">{field.replaceAll("_", " ")}{["description", "visitor_info", "participation_info", "cancellation_policy"].includes(field) ? <textarea name={field} defaultValue={item[field] ?? ""} rows={5} className="mt-2 w-full rounded-xl border border-[#dce2dc] p-3 font-normal" /> : <input name={field} defaultValue={item[field] ?? ""} className="mt-2 w-full rounded-xl border border-[#dce2dc] p-3 font-normal" />}</label>)}
      <MediaInput initialUrl={item.image_url} initialAlt={item.image_alt} onBusy={setUploading} />
      <label className="block text-sm font-semibold">Publication<select name="status" defaultValue={item.status} className="ml-3 rounded-xl border border-[#dce2dc] p-3"><option value="draft">Draft</option><option value="published">Published</option></select></label>
      <button disabled={busy || uploading} className="rounded-full bg-[#17201d] px-6 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : uploading ? "Uploading…" : "Save changes"}</button>
    </fieldset>
    {feedback && <p role={feedback.ok ? "status" : "alert"}>{feedback.message}</p>}
  </form>;
}
