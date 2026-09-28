import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { eventDate } from "@/lib/events";
import { ContentImage } from "@/components/content-image";
import { eventRequestTime } from "@/lib/event-request-time";

export async function HomeEvents() {
  const now = await eventRequestTime();
  let events: { id: string; title: string; public_area: string; starts_at: string; application_deadline: string | null; image_url: string | null; image_alt: string | null }[] | null = null;
  try {
    const client = await createClient();
    const { data, error } = await client.from("events")
      .select("id,title,public_area,starts_at,application_deadline,image_url,image_alt")
      .eq("status", "published").gt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true }).limit(3);
    if (!error) events = data;
  } catch { /* Public fields only. No applications or meeting-detail query. */ }
  return <div className="rounded-2xl border border-white/50 bg-white/75 p-5 text-[#59423c]">
    <h3 className="text-lg font-semibold">Upcoming gatherings</h3>
    {events === null ? <p role="status" className="mt-4 text-sm leading-6">We couldn’t load upcoming events. Please try the Events page again later.</p>
      : !events.length ? <p className="mt-4 text-sm leading-6">No upcoming events have been published yet. Check back for new gatherings.</p>
      : <ul className="mt-4 divide-y divide-[#dfb6a7]">{events.map(event => <li key={event.id} className="py-4"><Link href={`/event/${event.id}`} className="block rounded-md"><ContentImage url={event.image_url} alt={event.image_alt} /><p className="mt-3 font-semibold">{event.title} →</p><p className="mt-2 text-sm">{event.public_area}</p><time dateTime={event.starts_at} className="mt-1 block text-xs">{eventDate(event.starts_at)}</time><p className="mt-2 text-xs font-semibold">{event.application_deadline && Date.parse(event.application_deadline) <= now ? "Applications closed" : "Applications open · approval required"}</p></Link></li>)}</ul>}
  </div>;
}
