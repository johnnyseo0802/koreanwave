"use client";
import { CommercialDisclosure } from "@/components/commercial-disclosure";
import Link from "next/link";
import { useRef,useState } from "react";
import { useRouter } from "next/navigation";
import { editMemberContent } from "@/app/community/member-actions";
import { parseYouTube } from "@/lib/youtube";
import { topics,uuid } from "@/lib/community";
import { editInput,type OwnedContent } from "@/lib/member-content";
const input="mt-2 block w-full min-w-0 rounded-xl border bg-white p-3";
export function MemberEditForm({item}:{item:OwnedContent}){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [media,setMedia]=useState(item.youtube_video_id?"youtube":"photo");
  const [url,setUrl]=useState(item.youtube_video_id?`https://www.youtube.com/watch?v=${item.youtube_video_id}`:"");
  const [image,setImage]=useState(item.image_id??"");
  const file=useRef<HTMLInputElement>(null),lock=useRef(false),router=useRouter();
  const post=item.kind==="post",photo=post&&item.type!=="discussion",moment=item.type==="moment";
  return <form className="min-w-0 space-y-5 rounded-2xl border bg-white p-5 sm:p-8" onSubmit={async e=>{
    e.preventDefault();if(lock.current)return;const form=new FormData(e.currentTarget);lock.current=true;setBusy(true);setMessage("Saving…");
    try{
      let imageId=image;
      if(photo&&media==="photo"&&file.current?.files?.[0]){
        const chosen=file.current.files[0];if(chosen.size>2097152||!["image/jpeg","image/png","image/webp"].includes(chosen.type)){setMessage("Choose JPEG, PNG or WebP, at most 2 MiB.");return;}
        const upload=new FormData();upload.set("file",chosen);
        const response=await fetch("/community/media/upload",{method:"POST",body:upload});const result=await response.json();
        if(!response.ok||typeof result.image_id!=="string"||!uuid.test(result.image_id)){setMessage("Photo upload failed. Your original is unchanged.");return;}
        imageId=result.image_id;setImage(imageId);file.current.value="";
      }
      form.set("image_id",media==="photo"?imageId:"");form.set("youtube_video_id",media==="youtube"?parseYouTube(url)??"":"");
      if(media==="youtube"&&!parseYouTube(url)){setMessage("Use a valid HTTPS YouTube URL.");return;}
      const validation=editInput(item,form);if(validation.error){setMessage(validation.error);return;}
      const r=await editMemberContent(item.kind,item.id,String(item.revision),form);setMessage(r.message);
      if(r.ok){router.replace(`/account/contributions?edited=${"cleanupPending" in r&&r.cleanupPending?"pending-image":"1"}`);router.refresh();}
    }catch{setMessage("Could not confirm this edit. Reload before trying again.");}finally{lock.current=false;setBusy(false);}
  }}>
    <p>{"General edits appear immediately. Commercial or already-held submissions await review and stay hidden. Original creation and publication dates are preserved."}</p>
    <fieldset disabled={busy} className="min-w-0 space-y-5"><CommercialDisclosure value={item.commercial_disclosure??"unspecified"} disabled={busy}/>
      {(post||item.kind==="question")&&<label className="block">Title{moment?" (optional)":""}<input name="title" defaultValue={item.title??""} required={!moment} maxLength={160} className={input}/></label>}
      <label className="block">{moment?"Caption":"Body"}<textarea name="body" defaultValue={item.body} required rows={8} className={input}/></label>
      {moment&&<label className="block">Media<select className={input} value={media} onChange={e=>setMedia(e.target.value)}><option value="photo">Photo</option><option value="youtube">YouTube video</option></select></label>}
      {photo&&media==="photo"&&<><p className="text-sm">{image?"Your existing photo is kept unless you select a replacement.":"Choose a photo."} Use only images you have permission to share.</p><label className="block">Replacement photo<input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className={`${input} text-sm`}/></label><label className="block">Photo description<input name="image_alt" maxLength={240} defaultValue={item.image_alt??""} className={input}/></label></>}
      {moment&&media==="youtube"&&<label className="block">YouTube URL<input type="url" maxLength={2048} value={url} onChange={e=>setUrl(e.target.value)} className={input}/><span className="text-sm">Changed links are verified on the server before saving.</span></label>}
      {post&&item.type!=="discussion"&&<><label className="block">Broad location<input name="location_label" maxLength={120} defaultValue={item.location_label??""} className={input}/></label><label className="block">Topic<select name="topic" defaultValue={item.topic??""} className={input}><option value="">Choose a topic</option>{topics.map(t=><option key={t}>{t}</option>)}</select></label></>}
      <div className="flex flex-wrap gap-3"><button className="rounded-full bg-[#171717] px-6 py-3 text-white disabled:opacity-50">{busy?"Saving…":"Save changes"}</button>{!busy&&<Link className="rounded-full border px-6 py-3" href="/account/contributions">Cancel</Link>}</div>
    </fieldset><p role="status" aria-live="polite">{message}</p>
  </form>;
}
