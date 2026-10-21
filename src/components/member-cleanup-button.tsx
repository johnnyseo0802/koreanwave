"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {retryMemberMedia} from "@/app/community/member-actions";
export function MemberCleanupButton({id}:{id:string}){
  const lock=useRef(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),router=useRouter();
  return <div><button disabled={busy} className="rounded-full border px-5 py-3" onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{const r=await retryMemberMedia(id);setMessage(r.message);if(r.ok)router.refresh();}catch{setMessage("Cleanup remains pending.");}finally{lock.current=false;setBusy(false);}}}>{busy?"Retrying…":"Retry image cleanup"}</button><p role="status">{message}</p></div>;
}
