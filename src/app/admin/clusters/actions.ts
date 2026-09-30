"use server";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { uuidPattern } from "@/lib/editorial";
import { isTarget, targets, orderValue, promptKinds, validateCluster } from "@/lib/clusters";
import { revalidatePath } from "next/cache";
const failure={ok:false,message:"Could not save. Check access, reload the list and try again."};
const refresh=()=>revalidatePath("/","layout");
export async function saveCluster(id:unknown,revision:unknown,form:FormData){
  const access=await getAdminAccess();if(access.status!=="admin")return failure;
  if(!(form instanceof FormData)||(id!==null&&(typeof id!=="string"||!uuidPattern.test(id)||typeof revision!=="string"||revision.length>64||!Number.isFinite(Date.parse(revision)))))return failure;
  const checked=validateCluster(form);if(!checked.value)return {ok:false,message:checked.error??"Check the fields."};
  try{const q=id===null?access.client.from("content_clusters").insert(checked.value):access.client.from("content_clusters").update(checked.value).eq("id",id).eq("updated_at",revision);
    const r=await q.select("id,updated_at").maybeSingle();if(r.error||!r.data)return {ok:false,message:r.error?.code==="23505"?"That slug is already in use. Open the existing topic or choose another slug.":"This topic changed or could not be saved. Reload before retrying."};refresh();return {ok:true,id:r.data.id as string,revision:r.data.updated_at as string,message:"Topic saved. Connected content keeps its own publication state."};
  }catch{return failure;}
}
export async function saveClusterLink(clusterId:unknown,id:unknown,form:FormData){
  const access=await getAdminAccess();if(access.status!=="admin")return failure;
  if(typeof clusterId!=="string"||!uuidPattern.test(clusterId)||!(form instanceof FormData)||(id!==null&&(typeof id!=="string"||!uuidPattern.test(id))))return failure;
  const order=orderValue(form.get("display_order"));if(order===null)return {ok:false,message:"Order must be 0–9999."};
  try{
    let query;
    if(id===null){const target=form.get("target"),targetId=form.get("target_id");if(!isTarget(target)||typeof targetId!=="string"||!uuidPattern.test(targetId))return failure;
      const config=targets[target];let check=access.client.from(config.table).select("id").eq("id",targetId);
      if(config.status==="approved")check=check.eq("status","approved");
      const r=await check.maybeSingle();if(r.error||!r.data)return {ok:false,message:"Select available content. Questions and community posts must be approved."};
      query=access.client.from("content_cluster_items").insert({cluster_id:clusterId,[target]:targetId,display_order:order});
    }else query=access.client.from("content_cluster_items").update({display_order:order}).eq("id",id).eq("cluster_id",clusterId);
    const r=await query.select("id").maybeSingle();if(r.error||!r.data)return {ok:false,message:r.error?.code==="23505"?"That content is already connected.":"Connection unavailable or changed. Reload the topic."};refresh();return {ok:true,message:"Connection saved. No target content was published."};
  }catch{return failure;}
}
export async function saveClusterPrompt(clusterId:unknown,id:unknown,form:FormData){
  const access=await getAdminAccess();if(access.status!=="admin")return failure;
  if(typeof clusterId!=="string"||!uuidPattern.test(clusterId)||!(form instanceof FormData)||(id!==null&&(typeof id!=="string"||!uuidPattern.test(id))))return failure;
  const kind=form.get("kind"),raw=form.get("prompt"),order=orderValue(form.get("display_order"));
  if(typeof kind!=="string"||!promptKinds.includes(kind as typeof promptKinds[number])||typeof raw!=="string"||Array.from(raw.trim()).length<5||Array.from(raw.trim()).length>500||order===null)return {ok:false,message:"Choose a type, write 5–500 characters and set an order from 0–9999."};
  const value={kind,prompt:raw.trim(),display_order:order};
  try{const q=id===null?access.client.from("content_cluster_prompts").insert({cluster_id:clusterId,...value}):access.client.from("content_cluster_prompts").update(value).eq("id",id).eq("cluster_id",clusterId);const r=await q.select("id").maybeSingle();if(r.error||!r.data)return {ok:false,message:"Prompt could not be saved. Check for duplicates or reload."};refresh();return {ok:true,message:"Editorial prompt saved. No member content was created."};}catch{return failure;}
}
export async function removeClusterEntry(clusterId:unknown,id:unknown,kind:unknown){
  const access=await getAdminAccess();if(access.status!=="admin")return failure;
  if(typeof clusterId!=="string"||!uuidPattern.test(clusterId)||typeof id!=="string"||!uuidPattern.test(id)||(kind!=="item"&&kind!=="prompt"))return failure;
  try{const table=kind==="item"?"content_cluster_items":"content_cluster_prompts";const r=await access.client.from(table).delete().eq("id",id).eq("cluster_id",clusterId).select("id").maybeSingle();if(r.error||!r.data)return failure;refresh();return {ok:true,message:"Removed from this topic. Original content was not deleted."};}catch{return failure;}
}
