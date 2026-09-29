import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { CommunityShell } from "@/components/community-shell";
type Contribution={id:string;kind:string;title:string|null;body:string;status:string;created_at:string;is_featured:boolean;target_id:string};
export const metadata={title:"My Contributions",robots:{index:false,follow:false}};
export default async function Page(){
  await requireUser("/account/contributions");
  let items:Contribution[]|null=null;
  try{const client=await createClient();const {data,error}=await client.rpc("my_community_contributions");if(!error)items=data??[];}catch{/* Private fail-closed state. */}
  return <CommunityShell title="My Contributions" description="Your Moments, Stories, Tips, Questions, Answers and Reviews. Only you can view this personal submission history."><Link className="inline-block rounded-full bg-[#17201d] px-5 py-3 text-white" href="/write">Share something about Korea</Link>
    {items===null ? <p role="alert" className="mt-6">Your contributions couldn’t be loaded. Please try again later.</p> : !items.length ? <p className="mt-6">Your first contribution starts here. Share a moment, a story or a useful tip.</p> : <div className="mt-8 grid gap-5 sm:grid-cols-2">{items.map(p=>{const href=p.kind==="question"||p.kind==="answer" ? `/community/questions/${p.target_id}` : p.kind==="review" ? `/local-korea/places/${p.target_id}` : `/community/posts/${p.id}`;return <article key={`${p.kind}-${p.id}`} className="min-w-0 rounded-2xl border bg-white p-6"><p className="text-sm capitalize">{p.kind} · {p.status==="approved"?"Published":p.status}{p.is_featured?" · Featured":""}</p><h2 className="mt-3 break-words text-xl font-semibold">{p.title??`Your ${p.kind}`}</h2><p className="mt-3 whitespace-pre-wrap break-words leading-7">{p.body}</p><time className="mt-4 block text-xs">{new Date(p.created_at).toLocaleDateString("en",{timeZone:"Asia/Seoul"})}</time>{p.status==="approved"&&<Link className="mt-4 inline-block py-2 underline" href={href}>View published contribution</Link>}{p.status==="rejected"&&<p className="mt-4 text-sm">Review the community guidelines before creating a new contribution.</p>}</article>;})}</div>}
    <p className="mt-6 text-sm">Showing your 100 most recent contributions. Posts cannot be edited after submission.</p>
  </CommunityShell>;
}
