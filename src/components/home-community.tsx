import Link from "next/link";
import { publicPosts } from "@/lib/community-data";
import { CommunityCards } from "@/components/community-shell";
export async function HomeCommunity(){
  const featured=await publicPosts(undefined,true);
  const posts=featured?.length ? featured : await publicPosts();
  return <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-10"><p className="text-xs uppercase tracking-widest text-[#557b39]">Shared by the community</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Korea Through Your Eyes</h2><p className="my-5 text-[#626c66]">Small discoveries. Honest experiences. Helpful local knowledge.</p>{posts?.length ? <CommunityCards cards={posts.slice(0,3).map(p=>({...p,title:p.title??"Korea Moment",href:`/community/posts/${p.id}`}))} /> : <p className="rounded-2xl bg-[#edf3e5] p-7">{posts===null?"Community stories are temporarily unavailable.":"Be the first to share a Korea moment."}</p>}<div className="mt-5 flex flex-wrap gap-5"><Link href="/community" className="py-3 font-semibold underline">Explore Community →</Link><Link href="/write" className="py-3 font-semibold underline">Share your Korea →</Link></div></section>;
}
