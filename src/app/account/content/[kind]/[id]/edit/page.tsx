import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { ownContent } from "@/lib/member-content-data";
import { validKind } from "@/lib/member-content";
import { CommunityShell } from "@/components/community-shell";
import { MemberEditForm } from "@/components/member-edit-form";
export const metadata={title:"Edit your content",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{kind:string;id:string}>}){
  const {kind,id}=await params;if(!validKind(kind))notFound();
  await requireUser("/account/contributions");
  const p=(await ownContent(id))?.find(r=>r.id===id&&r.kind===kind);
  if(!p||!["pending","approved"].includes(p.status))notFound();
  return <CommunityShell title="Edit your content" description="Only you can edit this submission."><div className="mx-auto max-w-2xl"><MemberEditForm item={p}/></div></CommunityShell>;
}
