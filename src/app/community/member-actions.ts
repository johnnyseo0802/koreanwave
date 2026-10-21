"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { uuid } from "@/lib/community";
import { editInput, validKind, validRevision, type OwnedContent } from "@/lib/member-content";
import { verifyMemberVideo } from "@/lib/verify-member-video";
import { cleanupRetiredMedia } from "@/lib/member-media-cleanup";
const failure={ok:false,message:"This content changed or is unavailable. Reload before trying again."};
export async function editMemberContent(kind:string,id:string,revision:string,form:FormData){
  if(!validKind(kind)||!uuid.test(id)||!validRevision(revision)||!(form instanceof FormData))return failure;
  try{
    const client=await createClient(),auth=await client.auth.getUser();if(auth.error||!auth.data.user)return failure;
    const rows=await client.rpc("my_manageable_content",{target:id});
    const p=(rows.data as OwnedContent[]|null)?.find(r=>r.id===id&&r.kind===kind);
    if(rows.error||!p||String(p.revision)!==revision||!["pending","approved"].includes(p.status))return failure;
    const {patch,error}=editInput(p,form);if(error)return{ok:false,message:error};
    if(kind==="post"){
      if(patch.youtube_video_id && patch.youtube_video_id!==p.youtube_video_id){
        const video=await verifyMemberVideo(patch.youtube_video_id);if(!video)return{ok:false,message:"Could not verify this YouTube video. Your original has not changed."};
        patch.youtube_title=video.title;patch.youtube_channel_name=video.channel;
      }else{patch.youtube_title=patch.youtube_video_id?p.youtube_title??null:null;patch.youtube_channel_name=patch.youtube_video_id?p.youtube_channel_name??null:null;}
    }
    const r=await client.rpc("manage_member_content",{kind,target:id,expected_revision:revision,operation:"edit",patch});
    if(r.error||r.data?.id!==id)return failure;
    revalidatePath("/","layout");
    const cleanup=kind!=="post"||!p.image_id||p.image_id===patch.image_id||await cleanupRetiredMedia(id);
    return{ok:true,cleanupPending:!cleanup,message:(r.data.changed===false?"No changes to save.":r.data.status==="approved"?"Changes saved and public.":"Changes saved for review. This content remains hidden until approved.")+(cleanup?"":" Previous image cleanup is pending; access through KGROOV is blocked.")};
  }catch{return failure;}
}
export async function deleteMemberContent(kind:string,id:string,revision:string){
  if(!validKind(kind)||!uuid.test(id)||!validRevision(revision))return failure;
  try{
    const client=await createClient(),auth=await client.auth.getUser();if(auth.error||!auth.data.user)return failure;
    const r=await client.rpc("manage_member_content",{kind,target:id,expected_revision:revision,operation:"delete"});
    if(r.error||r.data?.id!==id||r.data.status!=="deleted")return failure;
    revalidatePath("/","layout");
    const cleaned=!r.data.cleanup_pending||await cleanupRetiredMedia(id);
    return{ok:true,cleanupPending:!cleaned,message:cleaned?"Removed from KGROOV pages and APIs. Previously cached or saved copies may remain.":"Content is hidden. Image cleanup is pending and requires a retry; it has not been reported as completed."};
  }catch{return failure;}
}
export async function retryMemberMedia(id:string){
  if(!uuid.test(id))return failure;
  const access=await getAdminAccess();if(access.status!=="admin")return failure;
  const ok=await cleanupRetiredMedia(id);revalidatePath("/admin/community");
  return{ok,message:ok?"Image cleanup confirmed. Previously cached copies may remain.":"Image cleanup is still pending. Content remains hidden."};
}
