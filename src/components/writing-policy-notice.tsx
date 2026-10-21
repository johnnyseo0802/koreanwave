import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
export async function WritingPolicyNotice(){
  let restriction:{mode:string;expires_at:string;case_id?:string}|undefined,unavailable=false;
  try{
    const client=await createClient(),r=await client.rpc("my_writing_restriction");
    if(r.error)unavailable=true;else restriction=r.data?.[0];
  }catch{unavailable=true;}
  if(unavailable)return <p role="status" className="my-4 text-sm">Writing status could not be loaded. Server permission checks still apply.</p>;
  if(!restriction||restriction.mode==="clear")return null;
  return <aside className="my-5 rounded-xl border border-amber-600 bg-amber-50 p-4 [overflow-wrap:anywhere]" aria-label="Writing status"><p>{restriction.mode==="warning"?"A moderator has issued a community-policy warning. You can still contribute; review the posting rules before writing.":restriction.mode==="restricted"?`Writing is temporarily restricted until ${new Date(restriction.expires_at).toUTCString()}.`:"Writing is suspended until moderator review."}</p>{restriction.case_id&&<p className="mt-2 text-sm">Private support reference: {restriction.case_id}</p>}<p className="mt-2 text-sm">This does not prevent reading, signing in or deleting your content. You may <Link className="underline" href="/contact">contact the operator</Link> with your reference to request reconsideration; moderators can reverse a mistaken restriction. Do not include private information in a public post.</p></aside>;
}
