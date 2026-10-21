"use client";
import { useRef,useState } from "react";
import { useRouter } from "next/navigation";
import { reportMemberPolicy,reviewMemberPolicy,clearWritingRestriction } from "@/app/community/policy-actions";
export function ClearWritingRestriction({id,version}:{id:string;version:string}){
  const lock=useRef(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),router=useRouter();
  return <form className="mt-4 space-y-3" onSubmit={async e=>{e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);try{const r=await clearWritingRestriction(id,version);setMessage(r.message);if(r.ok)router.refresh();}catch{setMessage("Decision not confirmed. Reload before retrying.");}finally{lock.current=false;setBusy(false);}}}>
    <label className="flex items-start gap-2"><input type="checkbox" required disabled={busy}/>I reviewed this restriction. Clearing it does not restore hidden or deleted content.</label><button disabled={busy} className="rounded-full border px-4 py-3">{busy?"Saving…":"Clear writing restriction"}</button><p role="status">{message}</p>
  </form>;
}
export function MemberPolicyReport({kind,id}:{kind:string;id:string}){
  const lock=useRef(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  return <details className="my-3 text-sm"><summary className="cursor-pointer py-2 underline">Report policy issue</summary><form className="space-y-3 rounded-xl border p-3" onSubmit={async e=>{e.preventDefault();if(lock.current)return;const f=new FormData(e.currentTarget);lock.current=true;setBusy(true);try{setMessage((await reportMemberPolicy(kind,id,String(f.get("reason")))).message);}catch{setMessage("Report unavailable. Please try later.");}finally{lock.current=false;setBusy(false);}}}>
    <label>Reason<select name="reason" className="ml-2 max-w-full rounded border p-2"><option value="commercial">Undisclosed advertising / paid recruitment</option><option value="spam">Spam / repeated promotion</option><option value="abuse">Abuse</option><option value="privacy">Privacy</option><option value="illegal">Suspected illegal content</option><option value="other">Other</option></select></label><button disabled={busy} className="block rounded-full border px-4 py-2">{busy?"Sending…":"Send policy report"}</button><p role="status">{message}</p>
  </form></details>;
}
export function PolicyReview({kind,id,revision,status}:{kind:string;id:string;revision:string;status:string}){
  const lock=useRef(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),router=useRouter();
  return <form className="mt-4 space-y-3" onSubmit={async e=>{e.preventDefault();if(lock.current)return;const f=new FormData(e.currentTarget);lock.current=true;setBusy(true);try{const r=await reviewMemberPolicy(kind,id,revision,String(f.get("action")),String(f.get("reason")));setMessage(r.message);if(r.ok)router.refresh();}catch{setMessage("Decision not confirmed. Reload before retrying.");}finally{lock.current=false;setBusy(false);}}}>
    <fieldset disabled={busy} className="space-y-3"><label className="block">Decision<select name="action" className="ml-2 rounded border p-2">{status==="pending"&&<option value="approve">Approve reviewed content</option>}{status==="approved"&&<option value="hide">Hide content</option>}{status==="rejected"&&<option value="restore">Restore after re-review</option>}<option value="keep">Keep current state / resolve report</option><option value="warn">Warn author (does not block writing)</option><option value="restrict">Restrict author writing for 7 days</option><option value="suspend">Suspend author writing until manual review</option></select></label>
    <label className="block">Reason<select name="reason" className="ml-2 rounded border p-2">{["commercial","spam","abuse","privacy","illegal","other","false_positive"].map(r=><option key={r}>{r}</option>)}</select></label>
    <label className="flex items-start gap-2"><input type="checkbox" required className="mt-1"/>I reviewed this content. Author restrictions affect all member-content writing, not login or deletion. Reports alone are not proof.</label><button className="rounded-full border px-5 py-3">{busy?"Saving…":"Record decision"}</button></fieldset><p role="status">{message}</p>
  </form>;
}
