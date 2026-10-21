import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { ownContent } from "@/lib/member-content-data";
import { contentHref } from "@/lib/member-content";
import { CommunityShell } from "@/components/community-shell";
import { MemberOwnerMenu } from "@/components/member-owner-menu";
import { EditedTimestamp } from "@/components/edited-timestamp";
import { WritingPolicyNotice } from "@/components/writing-policy-notice";
export const metadata={title:"My Contributions",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{removed?:string;edited?:string}>}){
  await requireUser("/account/contributions");
  const query=await searchParams,rows=await ownContent();
  const items=rows?.sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,100);
  return <CommunityShell title="My Contributions" description="Your posts, questions, answers, reviews, comments and replies. Only you can view this submission history.">
    <Link className="inline-block rounded-full bg-[#17201d] px-5 py-3 text-white" href="/write">Share something about Korea</Link>
    <WritingPolicyNotice/>
    {query.removed&&<p role="status" className="mt-5">Content removed from KGROOV pages and APIs.{query.removed==="pending-image"?" Image cleanup is still pending; it has not been reported as complete.":" Previously cached or saved copies may remain."}</p>}
    {query.edited&&<p role="status" className="mt-5">Save completed. Check the current status below. General edits appear immediately; commercial or held submissions require review. Unchanged saves do not create an edit timestamp.{query.edited==="pending-image"&&" Previous image cleanup is still pending and requires a retry."}</p>}
    {!items?<p role="alert" className="mt-6">Your contributions couldn’t be loaded. Please try again later.</p>:!items.length?<p className="mt-6">No available contributions yet.</p>:<div className="mt-8 grid gap-5 sm:grid-cols-2">{items.map(p=><article key={p.kind+"-"+p.id} className="min-w-0 rounded-2xl border bg-white p-6">
      <MemberOwnerMenu kind={p.kind} id={p.id} revision={String(p.revision)} status={p.status}/>
      <p className="text-sm capitalize">{p.type??(p.parent_comment_id?"reply":p.kind)} · {p.status==="approved"?"Published":p.status}</p>
      <h2 className="mt-3 break-words text-xl font-semibold">{p.title??"Your "+p.kind}</h2><p className="mt-3 whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-7">{p.body}</p>
      <time className="mt-4 block text-xs" dateTime={p.created_at}>{new Date(p.created_at).toLocaleDateString("en",{timeZone:"UTC"})}</time><EditedTimestamp value={p.edited_at}/>
      {p.status==="approved"&&<Link className="mt-4 inline-block py-2 underline" href={contentHref(p)}>View published contribution</Link>}
      {p.status==="rejected"&&<p className="mt-4 text-sm">Hidden/rejected content cannot be edited or republished. You can delete it.</p>}
    </article>)}</div>}
    <p className="mt-6 text-sm">Showing your 100 most recent available contributions. Deleted content and content under deleted parents are excluded.</p>
  </CommunityShell>;
}
