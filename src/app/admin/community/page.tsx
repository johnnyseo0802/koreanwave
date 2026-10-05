import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { publicPostFields, type CommunityPost } from "@/lib/community";
import { CommunityShell, CommunityImage } from "@/components/community-shell";
import { CommunityAdminAction, WeeklyPromptEditor } from "@/components/community-admin";
import { AdminModerationNav } from "@/components/admin-moderation-nav";
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const access = await getAdminAccess();
  if (access.status === "unauthenticated") redirect("/login?next=/admin/community");
  if (access.status !== "admin") notFound();
  const { tab: input } = await searchParams;
  const tabs=["pending","approved","rejected","featured","reports","prompt"];
  const tab=input && tabs.includes(input) ? input : "pending";
  let posts: CommunityPost[] = [], reports: { id:string;post_id:string;reason:string;details:string|null;created_at:string }[] = [], prompt={prompt:"",suggested_type:"story"}, unavailable=false;
  try {
    if(tab==="prompt") {const r=await access.client.from("community_prompt").select("prompt,suggested_type").eq("id",true).maybeSingle();if(r.error)unavailable=true;else if(r.data)prompt=r.data;}
    else if(tab==="reports") {const r=await access.client.from("community_reports").select("id,post_id,reason,details,created_at").eq("status","open").order("created_at").limit(50);if(r.error)unavailable=true;else reports=r.data??[];}
    else {let q=access.client.from("community_posts").select(`${publicPostFields},status,created_at`).eq("status",tab==="featured" ? "approved" : tab);if(tab==="featured")q=q.eq("is_featured",true);const r=await q.order("created_at").limit(50);if(r.error)unavailable=true;else posts=(r.data??[]) as unknown as CommunityPost[];}
  } catch {unavailable=true;}
  return <CommunityShell title="Community moderation" description="Review member contributions. Rejection is terminal; only approved posts can be featured. Use Conversations for reports, comments and hiding published abuse. Member identity remains private."><AdminModerationNav active="community" />
    <nav aria-label="Community moderation filters" className="mb-8 flex flex-wrap gap-3">{tabs.map(t=><Link key={t} aria-current={tab===t ? "page":undefined} href={`/admin/community?tab=${t}`} className={`rounded-full border px-5 py-3 capitalize ${tab===t ? "bg-[#17201d] text-white":"bg-white"}`}>{t}</Link>)}</nav>
    {unavailable ? <p role="alert">This area couldn’t be loaded. Check that the reviewed migration is applied.</p> : tab==="prompt" ? <WeeklyPromptEditor prompt={prompt.prompt} type={prompt.suggested_type} /> : <div className="space-y-5">
      {!posts.length&&!reports.length&&<p>No items in this queue.</p>}
      {posts.map(p=><article key={p.id} className="max-w-3xl rounded-2xl border bg-white p-6">{p.image_id&&<CommunityImage id={p.image_id} alt={p.image_alt} />}<p className="mt-4 text-sm">{p.type} · {p.status}{p.is_featured ? " · Featured":""}</p><h2 className="mt-3 break-words text-2xl font-semibold">{p.title??"Korea Moment"}</h2><p className="mt-3 whitespace-pre-wrap break-words leading-7">{p.body}</p><p className="mt-3 text-sm">{p.topic} {p.location_label}</p><time className="mt-3 block text-xs">{p.created_at ? new Date(p.created_at).toLocaleString("en",{timeZone:"Asia/Seoul"}):""}</time><CommunityAdminAction id={p.id} status={p.status!} featured={p.is_featured} /></article>)}
      {reports.map(r=><article key={r.id} className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-semibold capitalize">{r.reason.replaceAll("_"," ")}</h2><p className="mt-3 whitespace-pre-wrap break-words">{r.details}</p><Link className="mt-4 inline-block underline" href="/admin/conversations?tab=reports">Review reported post/comment and moderation context</Link><p className="mt-3 text-sm">Review the content in Conversations before marking the report reviewed. Resolving does not hide content.</p><CommunityAdminAction id={r.id} status="open" report /></article>)}
      <p className="text-sm">Showing up to 50 oldest items.</p>
    </div>}
  </CommunityShell>;
}
