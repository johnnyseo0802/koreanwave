import { EditorialShell } from "@/components/editorial-content";
import { ClusterCards } from "@/components/cluster-content";
import { publicClusters } from "@/lib/cluster-data";
import { publicPageMetadata } from "@/lib/public-metadata";
export const metadata = publicPageMetadata("Explore Korea Find Your Groove.", "/explore");
export default async function Page(){const clusters=await publicClusters();return <EditorialShell title="Start with what you love" eyebrow="Find Your Groove. / Explore"><p className="mb-8 max-w-2xl leading-7 text-[#69736c]">Connect culture with real places, local experiences and conversations. Pick a topic and make it your own.</p>{clusters===null?<p role="status">Topics are temporarily unavailable. Please try again later.</p>:clusters.length?<ClusterCards clusters={clusters}/>:<p>New topics are being prepared. Explore Local Korea or ask a real question in the community.</p>}</EditorialShell>;}
