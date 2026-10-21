import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { CommunityShell } from "@/components/community-shell";
import { PolicyReview,ClearWritingRestriction } from "@/components/member-policy-controls";
export const metadata={title:"Member policy review",robots:{index:false,follow:false}};
type Row={id:string;kind:string;title?:string;body?:string;status:string;revision:number;review_reason?:string;reports?:number;action?:string;reason?:string;created_at?:string;expires_at?:string;repeat_violation?:boolean};
export default async function Page({searchParams}:{searchParams:Promise<{tab?:string}>}){
  const access=await getAdminAccess();
  if(access.status==="unauthenticated")redirect("/login?next=/admin/community");
  if(access.status!=="admin")notFound();
  const tabs=["pending","reports","hidden","restrictions","history"],input=(await searchParams).tab,tab=input&&tabs.includes(input)?input:"pending";
  let rows:Row[]=[],unavailable=false;
  try{const r=await access.client.rpc("member_policy_queue",{view_name:tab});if(r.error)unavailable=true;else rows=r.data??[];}catch{unavailable=true;}
  return <CommunityShell title="Member policy review" description="Review commercial submissions and reports. Reports do not automatically hide content or restrict members. Re-review can restore hidden content, never deleted content.">
    <nav aria-label="Policy queues" className="mb-6 flex flex-wrap gap-3">{tabs.map(t=><Link key={t} href={`/admin/member-policy?tab=${t}`} aria-current={tab===t?"page":undefined} className="rounded-full border px-4 py-3 capitalize">{t}</Link>)}</nav>
    <p className="mb-6"><Link className="underline" href="/admin/conversations?tab=reports">Existing conversation reports</Link>{" · "}<Link className="underline" href="/admin/community">Community moderation</Link></p>
    {unavailable?<p role="alert">Policy review unavailable. Confirm the reviewed migration is applied.</p>:!rows.length?<p>No items in this queue.</p>:<div className="space-y-5">{rows.map(p=><article key={p.kind+p.id} className="min-w-0 max-w-3xl rounded-2xl border bg-white p-5 [overflow-wrap:anywhere]">
      {tab==="restrictions"?<><h2 className="font-semibold">Writing status: {p.status}</h2><p className="text-sm">Case {p.id}</p>{p.expires_at&&<time dateTime={p.expires_at}>{p.expires_at}</time>}<ClearWritingRestriction id={p.id} version={String(p.revision)}/></>:tab==="history"?<><h2 className="font-semibold">{p.kind} · {p.action}</h2><p>{p.reason}{p.repeat_violation?" · Prior restriction/warning on record":""}</p><time dateTime={p.created_at}>{p.created_at}</time></>:<><h2 className="text-xl font-semibold">{p.title??p.kind}</h2><p className="my-3 whitespace-pre-wrap">{p.body}</p><p>{p.status} · {p.review_reason} · {p.reports??0} unresolved reports</p><PolicyReview kind={p.kind} id={p.id} revision={String(p.revision)} status={p.status}/></>}
    </article>)}</div>}
    <p className="mt-6 text-sm">Up to 50 oldest items per content type; history shows the 100 latest decisions. Deleted content and member identities are excluded. A warning does not hide content. Use a separate Hide decision when needed.</p>
  </CommunityShell>;
}
