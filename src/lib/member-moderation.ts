import "server-only";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { revalidatePath } from "next/cache";
import { uuid } from "@/lib/community";
import { validRevision,type ContentKind } from "@/lib/member-content";
export async function moderateMember(kind:ContentKind,id:unknown,decision:unknown,revision:unknown){
  const failure={ok:false,message:"This item changed or is unavailable. Reload the queue before reviewing again."};
  if(typeof id!=="string"||!uuid.test(id)||typeof revision!=="string"||!validRevision(revision)||typeof decision!=="string"||!["approved","rejected","feature","unfeature"].includes(decision))return failure;
  const access=await getAdminAccess();if(access.status!=="admin")return failure;
  try{
    const r=await access.client.rpc("manage_member_content",{kind,target:id,expected_revision:revision,operation:decision==="approved"?"approve":decision==="rejected"?"reject":decision});
    if(r.error||r.data?.id!==id)return failure;
    revalidatePath("/","layout");return{ok:true,message:"Moderation decision saved."};
  }catch{return failure;}
}
