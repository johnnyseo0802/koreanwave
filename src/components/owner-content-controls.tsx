import { ownContent } from "@/lib/member-content-data";
import type { ContentKind } from "@/lib/member-content";
import { MemberOwnerMenu } from "@/components/member-owner-menu";
import { MemberPolicyReport } from "@/components/member-policy-controls";
export async function OwnerContentControls({kind,id}:{kind:ContentKind;id:string}){
  const rows=await ownContent(id),p=rows?.find(r=>r.kind===kind&&r.id===id);
  return <>{p&&<MemberOwnerMenu kind={kind} id={id} revision={String(p.revision)} status={p.status}/>}<MemberPolicyReport kind={kind} id={id}/></>;
}
