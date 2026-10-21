"use client";
import Link from "next/link";
import { useRef,useState } from "react";
import { useRouter } from "next/navigation";
import { deleteMemberContent } from "@/app/community/member-actions";
import type { ContentKind } from "@/lib/member-content";
export function MemberOwnerMenu({kind,id,revision,status}:{kind:ContentKind;id:string;revision:string;status:string}){
  const dialog=useRef<HTMLDialogElement>(null),lock=useRef(false),router=useRouter();
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  return <div className="my-3 flex justify-end"><details className="relative"><summary aria-label="Manage your content" className="cursor-pointer rounded-full border px-4 py-2 text-xl focus-visible:outline-2">···</summary><div className="absolute right-0 z-10 min-w-36 rounded-xl border bg-white p-2 shadow-lg">
    {["pending","approved"].includes(status)&&<Link className="block rounded-lg px-4 py-3 underline" href={`/account/content/${kind}/${id}/edit`}>Edit</Link>}
    <button type="button" className="w-full rounded-lg px-4 py-3 text-left underline" onClick={()=>{setMessage("");dialog.current?.showModal();}}>Delete</button>
  </div></details><dialog ref={dialog} aria-labelledby={`delete-title-${id}`} onCancel={e=>{if(busy)e.preventDefault();}} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border p-6 backdrop:bg-black/40">
    <h2 id={`delete-title-${id}`} className="text-xl font-semibold">Delete this {kind==="post"?"post":kind}?</h2>
    <p className="mt-4">It will no longer appear on KGROOV’s normal pages or APIs, including your account and standard admin views. Replies to a deleted comment and answers to a deleted question will also be hidden. Copies previously saved by others may still exist.</p>
    <p className="mt-3 text-sm">Image removal can require a retry. Previously issued image URLs or cached copies may remain temporarily; deletion does not guarantee immediate removal of every copy.</p>
    <div className="mt-5 flex flex-wrap gap-3"><button type="button" autoFocus disabled={busy} onClick={()=>dialog.current?.close()} className="rounded-full border px-5 py-3">Cancel</button><button type="button" disabled={busy} className="rounded-full bg-[#171717] px-5 py-3 text-white disabled:opacity-50" onClick={async()=>{
      if(lock.current)return;lock.current=true;setBusy(true);setMessage("Deleting…");
      try{const r=await deleteMemberContent(kind,id,revision);setMessage(r.message);if(r.ok){dialog.current?.close();router.replace(`/account/contributions?removed=${"cleanupPending" in r&&r.cleanupPending?"pending-image":"complete"}`);router.refresh();}}
      catch{setMessage("Could not confirm deletion. Reload My Contributions before trying again.");}finally{lock.current=false;setBusy(false);}
    }}>{busy?"Deleting…":"Delete"}</button></div><p role="status" aria-live="polite" className="mt-4">{message}</p>
  </dialog></div>;
}
