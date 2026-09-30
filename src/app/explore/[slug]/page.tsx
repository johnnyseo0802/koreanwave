import { notFound } from "next/navigation";
import { EditorialShell } from "@/components/editorial-content";
import { ClusterBody } from "@/components/cluster-content";
import { publicCluster } from "@/lib/cluster-data";
import { publicMetadata } from "@/lib/public-metadata";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const c=await publicCluster(slug);return c?publicMetadata(c.title,c.summary,`/explore/${c.slug}`):{title:"Topic unavailable",robots:{index:false}};}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const cluster=await publicCluster(slug);if(!cluster)notFound();return <EditorialShell title={cluster.title} eyebrow="Beyond the Screen / Explore"><p className="mb-6 max-w-3xl text-xl leading-8">{cluster.summary}</p><ClusterBody cluster={cluster}/></EditorialShell>;}
