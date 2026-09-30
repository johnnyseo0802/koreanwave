import { requireEditorialAdmin } from "@/lib/editorial-admin";
import { EditorialShell } from "@/components/editorial-content";
import { ClusterEditor } from "@/components/cluster-admin";
import { AdminModerationNav } from "@/components/admin-moderation-nav";
export default async function Page(){await requireEditorialAdmin("/admin/clusters/new");return <EditorialShell title="Create topic" eyebrow="Administration"><AdminModerationNav active="clusters"/><ClusterEditor/></EditorialShell>;}
