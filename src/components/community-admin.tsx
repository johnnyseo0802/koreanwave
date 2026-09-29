"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { moderateCommunity, resolveCommunityReport, saveWeeklyPrompt } from "@/app/admin/community/actions";
import { type ActionResult, postTypes } from "@/lib/community";
export function CommunityAdminAction({ id, status, featured, report = false }: { id: string; status: string; featured?: boolean; report?: boolean }) {
  const lock = useRef(false); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const router=useRouter();
  async function run(decision: string) {
    if (lock.current) return; lock.current=true; setBusy(true);
    try { const result = report ? await resolveCommunityReport(id) : await moderateCommunity(id,decision); setMessage(result.message); if (result.ok) router.refresh(); }
    catch { setMessage("Could not confirm the change. Refresh before retrying."); }
    finally { lock.current=false; setBusy(false); }
  }
  const decisions = report ? ["Review complete"] : status === "pending" ? ["approved","rejected"] : status === "approved" ? [featured ? "unfeature" : "feature"] : [];
  return <div className="mt-5"><div className="flex flex-wrap gap-3">{decisions.map(d => <button key={d} disabled={busy} onClick={()=>run(d)} className="rounded-full border border-[#557b39] px-5 py-3 text-sm font-semibold capitalize disabled:opacity-50">{d === "approved" ? "Approve" : d === "rejected" ? "Reject" : d}</button>)}</div><p role="status" className="mt-3 text-sm">{message}</p></div>;
}
export function WeeklyPromptEditor({ prompt, type }: { prompt: string; type: string }) {
  const [result,setResult]=useState<ActionResult|null>(null); const [busy,setBusy]=useState(false); const lock=useRef(false); const router=useRouter();
  return <form className="space-y-4 rounded-2xl border bg-white p-6" onSubmit={async e=>{e.preventDefault(); if(lock.current)return; const form=new FormData(e.currentTarget); lock.current=true;setBusy(true);try{const r=await saveWeeklyPrompt(form);setResult(r);if(r.ok)router.refresh();}catch{setResult({ok:false,message:"Could not save the prompt."});}finally{lock.current=false;setBusy(false);}}}>
    <h2 className="text-xl font-semibold">Weekly prompt</h2><label className="block">Prompt<textarea name="prompt" defaultValue={prompt} required maxLength={240} disabled={busy} className="mt-2 w-full rounded-xl border p-3" /></label><label className="block">Contribution type<select name="suggested_type" defaultValue={type} disabled={busy} className="mt-2 w-full rounded-xl border bg-white p-3">{postTypes.map(t=><option key={t}>{t}</option>)}</select></label><button disabled={busy} className="rounded-full bg-[#17201d] px-5 py-3 text-white disabled:opacity-50">Save prompt</button><p role="status">{result?.message}</p>
  </form>;
}
