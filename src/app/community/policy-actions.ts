"use server";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { validKind,validRevision } from "@/lib/member-content";
import { uuid } from "@/lib/community";
import { revalidatePath } from "next/cache";
const failure={ok:false,message:"Unavailable or changed. Refresh before trying again."};
export async function clearWritingRestriction(caseId:string,version:string){
  if(!uuid.test(caseId)||!validRevision(version))return failure;
  try{const access=await getAdminAccess();if(access.status!=="admin")return failure;
    const r=await access.client.rpc("clear_member_writing_restriction",{case_id:caseId,expected_version:version});
    if(r.error)return failure;revalidatePath("/","layout");return{ok:true,message:"Writing restriction cleared. No content was restored."};
  }catch{return failure;}
}
export async function reportMemberPolicy(kind:string,id:string,reason:string){
  if(!validKind(kind)||!uuid.test(id)||!["commercial","spam","abuse","privacy","illegal","other"].includes(reason))return failure;
  try{const client=await createClient(),auth=await client.auth.getUser();if(auth.error||!auth.data.user)return{ok:false,message:"Please sign in to report this contribution."};
    const r=await client.rpc("report_member_content",{kind,target:id,reason});
    return r.error?failure:{ok:true,message:"Report received. A moderator will review it; reporting alone does not hide or suspend anyone."};
  }catch{return failure;}
}
export async function reviewMemberPolicy(kind:string,id:string,revision:string,action:string,reason:string){
  if(!validKind(kind)||!uuid.test(id)||!validRevision(revision)||!["approve","hide","keep","restore","warn","restrict","suspend"].includes(action)||!["commercial","spam","abuse","privacy","illegal","other","false_positive"].includes(reason))return failure;
  try{const access=await getAdminAccess();if(access.status!=="admin")return failure;
    const r=await access.client.rpc("review_member_policy",{kind,target:id,expected_revision:revision,action,reason});
    if(r.error)return failure;revalidatePath("/","layout");return{ok:true,message:"Decision recorded. Reloaded state is authoritative."};
  }catch{return failure;}
}
