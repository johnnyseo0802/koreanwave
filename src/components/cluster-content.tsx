import Link from "next/link";
import { DiscoveryCards } from "@/components/discovery-cards";
import { clusterContents, publicClusters, relatedContent } from "@/lib/cluster-data";
import type { Cluster, Target } from "@/lib/clusters";
export function ClusterCards({ clusters }: { clusters: Cluster[] }) {
  return <DiscoveryCards images={false} cards={clusters.map(c=>({id:c.id,title:c.title,summary:c.summary,href:`/explore/${c.slug}`,label:"Beyond the Screen"}))} />;
}
export async function ClusterBody({ cluster, preview=false }: { cluster: Cluster; preview?: boolean }) {
  const content=await clusterContents(cluster.id,preview);
  return <><p className="max-w-3xl whitespace-pre-wrap break-words text-lg leading-8 text-[#56625a]">{cluster.introduction}</p>
    {content.unavailable&&<p role="status" className="mt-6">Some discoveries are temporarily unavailable.</p>}
    {content.groups.filter(g=>g.cards.length).map(g=><section key={g.key} className="mt-10"><h2 className="mb-5 text-2xl font-semibold">{g.label}</h2><DiscoveryCards cards={g.cards} images={!['question_id','community_post_id'].includes(g.key)} /></section>)}
    {!!content.prompts.length&&<section className="mt-10 rounded-2xl bg-[#edf3e5] p-6"><h2 className="text-2xl font-semibold">Make it your Korea</h2><p className="mt-3 text-sm">Editorial ideas, not member posts. Share only genuine questions and experiences; contributions are reviewed before publication.</p><ul className="mt-5 space-y-5">{content.prompts.map(p=><li key={p.id}><p className="break-words">{p.prompt}</p><Link className="mt-2 inline-block py-2 font-semibold underline" href={p.kind==="question"?"/write/question":`/write/${p.kind}`}>{p.kind==="question"?"Ask a real question":`Share a ${p.kind}`} →</Link></li>)}</ul></section>}
    <Link href="/explore" className="mt-10 inline-block py-3 underline">← Explore all topics</Link></>;
}
export async function RelatedContent({ target,id }: { target:Target;id:string }) {
  const groups=await relatedContent(target,id); if(!groups.length)return null;
  return <section className="mt-12"><h2 className="text-2xl font-semibold">Continue beyond the screen</h2>{groups.map(g=><div key={g.slug} className="mt-6"><Link className="mb-4 inline-block py-2 font-semibold underline" href={`/explore/${g.slug}`}>Explore {g.title} →</Link>{!!g.cards.length&&<DiscoveryCards cards={g.cards} />}</div>)}</section>;
}
export async function HomeClusters() {
  const clusters=await publicClusters(4); if(!clusters?.length)return null;
  return <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-10"><h2 className="mb-6 text-3xl font-semibold">Start with what you love</h2><ClusterCards clusters={clusters} /><Link href="/explore" className="mt-5 inline-block py-3 font-semibold underline">Explore all topics →</Link></section>;
}
