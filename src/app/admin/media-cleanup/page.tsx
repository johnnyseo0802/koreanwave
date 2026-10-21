import {notFound,redirect} from "next/navigation";
import {getAdminAccess} from "@/lib/auth/admin-access";
import {CommunityShell} from "@/components/community-shell";
import {MemberCleanupButton} from "@/components/member-cleanup-button";
export const metadata={title:"Pending image cleanup",robots:{index:false,follow:false}};
export default async function Page(){
  const access=await getAdminAccess();if(access.status==="unauthenticated")redirect("/login?next=/admin/media-cleanup");if(access.status!=="admin")notFound();
  const rows=await access.client.rpc("member_cleanup_pending");
  return <CommunityShell title="Pending image cleanup" description="Content stays unavailable during retries. No deleted text or image is displayed here.">{rows.error?<p role="alert">Queue unavailable.</p>:!rows.data?.length?<p>No pending cleanup.</p>:<ul className="space-y-5">{rows.data.map((r:{post_id:string;requested_at:string})=><li key={r.post_id} className="rounded-xl border bg-white p-5"><p>Requested <time dateTime={r.requested_at}>{new Date(r.requested_at).toLocaleDateString("en",{timeZone:"UTC"})}</time></p><MemberCleanupButton id={r.post_id}/></li>)}</ul>}</CommunityShell>;
}
