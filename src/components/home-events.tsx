import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { eventDate } from "@/lib/events";

export async function HomeEvents() {
  let events: { id: string; title: string; public_area: string; starts_at: string }[] | null = null;
  try {
    const client = await createClient();
    const { data, error } = await client.from("events")
      .select("id,title,public_area,starts_at")
      .eq("status", "published").gt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true }).limit(3);
    if (!error) events = data;
  } catch { /* Public fields only. No applications or meeting-detail query. */ }
  return <div className="rounded-2xl border border-white/50 bg-white/75 p-5 text-[#59423c]">
    <h3 className="text-lg font-semibold">Upcoming gatherings</h3>
    {events === null ? <p role="status" className="mt-4 text-sm leading-6">We couldn’t load upcoming events. Please try the Events page again later.</p>
      : !events.length ? <p className="mt-4 text-sm leading-6">No upcoming events have been published yet. Check back for new gatherings.</p>
      : <ul className="mt-4 divide-y divide-[#dfb6a7]">{events.map(event => <li key={event.id} className="py-4"><Link href={`/event/${event.id}`} className="block rounded-md"><p className="font-semibold">{event.title} →</p><p className="mt-2 text-sm">{event.public_area}</p><time dateTime={event.starts_at} className="mt-1 block text-xs">{eventDate(event.starts_at)}</time></Link></li>)}</ul>}
  </div>;
}
