import { notFound } from "next/navigation";
import { requireEditorialAdmin } from "@/lib/editorial-admin";
import { uuidPattern } from "@/lib/editorial";
import { clusterFields,type Cluster } from "@/lib/clusters";
import { EditorialShell } from "@/components/editorial-content";
import { ClusterBody } from "@/components/cluster-content";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;const client=await requireEditorialAdmin(`/admin/clusters/${id}/preview`);if(!uuidPattern.test(id))notFound();const r=await client.from('content_clusters').select(clusterFields).eq('id',id).maybeSingle();if(r.error||!r.data)notFound();return <EditorialShell title={r.data.title} eyebrow="Admin preview — not a public URL"><p className="mb-6">Preview includes only independently public targets. Publishing this topic will not publish any connected draft.</p><ClusterBody cluster={r.data as Cluster} preview/></EditorialShell>;}
