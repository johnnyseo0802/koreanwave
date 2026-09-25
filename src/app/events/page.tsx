export const metadata = { title: "Events" };

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EventShell } from "@/components/event-shell";
import { eventDate } from "@/lib/events";

type EventCard = { id: string; title: string; description: string; public_area: string; category: string; starts_at: string };
export default async function EventsPage() {
  let events: EventCard[] | null = null;
  try {
    const client = await createClient();
    const { data, error } = await client.from("events")
      .select("id,title,description,public_area,category,starts_at")
      .eq("status", "published").gt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true });
    if (!error && data) events = data;
  } catch { /* Safe unavailable state, including before the migration is applied. */ }
  return <EventShell title="Events">
    <p className="mb-8 leading-7 text-[#69736c]">Discover upcoming cultural gatherings and community meetups across Korea.</p>
    {events === null ? <p role="alert">We couldn’t load events. Please try again later.</p> : !events.length ? <p>No upcoming events have been published yet.</p> : <div className="grid gap-5 sm:grid-cols-2">{events.map((event) => <Link key={event.id} href={`/event/${event.id}`} className="rounded-2xl border border-[#e3e7e2] bg-white p-7 hover:shadow-lg">
      <p className="text-xs text-[#557b39]">{event.category} · {event.public_area}</p>
      <h2 className="mt-3 break-words text-2xl font-semibold">{event.title}</h2>
      <time dateTime={event.starts_at} className="mt-3 block text-sm font-medium">{eventDate(event.starts_at)}</time>
      <p className="mt-4 line-clamp-3 break-words text-sm leading-7 text-[#69736c]">{event.description}</p>
    </Link>)}</div>}
  </EventShell>;
}
