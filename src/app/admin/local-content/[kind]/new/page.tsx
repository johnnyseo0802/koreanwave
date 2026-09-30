import { notFound } from "next/navigation";
import { requireEditorialAdmin } from "@/lib/editorial-admin";
import { EditorialShell } from "@/components/editorial-content";
import { AdminModerationNav } from "@/components/admin-moderation-nav";
import { ManagedContentForm } from "@/components/managed-content-form";
export default async function Page({params}:{params:Promise<{kind:string}>}){const {kind}=await params;await requireEditorialAdmin(`/admin/local-content/${kind}/new`);if(kind!=="places"&&kind!=="experiences")notFound();return <EditorialShell title={`Create ${kind==='places'?'place':'experience'}`} eyebrow="Administration"><AdminModerationNav active="local-content"/><ManagedContentForm create kind={kind} item={{id:'',updated_at:'',status:'draft',image_url:null,image_alt:null}}/></EditorialShell>;}
