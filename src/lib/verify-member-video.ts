import "server-only";
import {createClient} from "@supabase/supabase-js";
import {getSupabaseServerConfig} from "@/lib/supabase/config";
import {youtubeMetadata} from "@/lib/youtube-metadata";
/** Server-generated metadata only. Caller authenticates and confirms ownership
 * first. This privilege can register public video metadata, never member edits. */
export async function verifyMemberVideo(id:string){
  const video=await youtubeMetadata(id);if(!video)return null;
  try{
    const key=process.env.SUPABASE_COMMUNITY_MEDIA_SECRET_KEY,{url}=getSupabaseServerConfig();
    if(!key?.startsWith("sb_secret_"))return null;
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(8000)})}});
    const r=await client.rpc("register_verified_member_video",{video_id:video.id,title:video.title,channel:video.channel});
    return r.error?null:video;
  }catch{return null;}
}
