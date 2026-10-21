import "server-only";
import { createClient as secretClient } from "@supabase/supabase-js";
import { getSupabaseServerConfig } from "@/lib/supabase/config";
import { uuid } from "@/lib/community";
/** Call ONLY after an authenticated DB mutation receipt or verified admin access.
 * Targets come exclusively from the DB's retired-media queue, not user paths.
 * Failure leaves a durable pending receipt for manual retry; never republishes.
 */
export async function cleanupRetiredMedia(target: string): Promise<boolean> {
  if (!uuid.test(target)) return false;
  try {
    const key=process.env.SUPABASE_COMMUNITY_MEDIA_SECRET_KEY;
    const {url}=getSupabaseServerConfig();
    if (!url || !key?.startsWith("sb_secret_")) return false;
    const client=secretClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(8000)})}});
    const jobs=await client.rpc("member_media_cleanup",{target});
    if(jobs.error || !Array.isArray(jobs.data)) return false;
    for(const row of jobs.data){
      if(!uuid.test(row.image_id)) return false;
      const path=`${row.image_id}/image.webp`;
      const removed=await client.storage.from("community-media").remove([path]);
      if(removed.error) return false;
      // Do not mistake a filtered/empty removal response for confirmed removal.
      // HEAD/exists conflates 400 permission errors with absence. Require the
      // structured object-specific error from GET info; unknown/legacy errors
      // remain pending rather than acknowledging a potentially retained object.
      const info=await client.storage.from("community-media").info(path);
      const missing=info.error;
      if(info.data || !missing || !("code" in missing) || missing.code!=="NoSuchKey" || ![400,404].includes(missing.status ?? 0)) return false;
      const ack=await client.rpc("member_media_cleanup",{target,completed:row.image_id});
      if(ack.error) return false;
    }
    const remaining=await client.rpc("member_media_cleanup",{target});
    return !remaining.error && Array.isArray(remaining.data) && remaining.data.length===0;
  } catch { return false; }
}
