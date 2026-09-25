export const metadata = { title: "My Events" };

import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { EventShell } from "@/components/event-shell";
import { applicationLabel, eventDate } from "@/lib/events";
import { eventRequestTime } from "@/lib/event-request-time";

type Application = { id: string; event_id: string; status: string };
type EventInfo = { id: string; title: string; starts_at: string; public_area: string };

export default async function MyEventsPage() {
  const user = await requireUser("/account/events");
  let applications: Application[] | null = null;
  const events = new Map<string, EventInfo>();
  const details = new Map<string, string>();
  let detailsFailed = false;
  try {
    const client = await createClient();
    // Explicit own filter is mandatory even when the current user is an admin.
    const own = await client.from("event_applications").select("id,event_id,status")
      .eq("member_id", user.id).order("created_at", { ascending: false });
    if (own.error) throw new Error("Applications unavailable");
    const rows: Application[] = own.data ?? [];
    if (rows.length) {
      const visible = await client.from("events").select("id,title,starts_at,public_area")
        .in("id", rows.map((row) => row.event_id)).eq("status", "published");
      if (visible.error) throw new Error("Events unavailable");
      for (const event of visible.data ?? []) events.set(event.id, event);
      const approved = rows.filter((row) => row.status === "approved" && events.has(row.event_id)).map((row) => row.event_id);
      if (approved.length) {
        // Fetch ONLY approved own event IDs. RLS independently checks auth.uid()
        // and approval, so bypassing the UI cannot disclose another event's data.
        const privateResult = await client.from("event_meeting_details")
          .select("event_id,meeting_details").in("event_id", approved);
        detailsFailed = !!privateResult.error;
        if (!privateResult.error) for (const detail of privateResult.data ?? []) details.set(detail.event_id, detail.meeting_details);
      }
    }
    const now = await eventRequestTime();
    applications = rows.sort((a, b) => {
      const ta = Date.parse(events.get(a.event_id)?.starts_at ?? "");
      const tb = Date.parse(events.get(b.event_id)?.starts_at ?? "");
      const upcomingA = Number.isFinite(ta) && ta > now;
      const upcomingB = Number.isFinite(tb) && tb > now;
      if (upcomingA !== upcomingB) return upcomingA ? -1 : 1;
      return upcomingA ? ta - tb : (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
  } catch { /* Fail closed, never log identities, sessions, or meeting data. */ }
  return <EventShell title="My Events">
    {applications === null ? <p role="alert">We couldn’t load your applications. Please refresh or try again later.</p> : !applications.length ? <p>You haven’t applied to any events yet. <Link href="/events" className="underline">Explore Events</Link></p> : <div className="space-y-5">{applications.map((application) => {
      const event = events.get(application.event_id);
      return <article key={application.id} className="rounded-2xl border border-[#e3e7e2] bg-white p-7">
        <span className="rounded-full bg-[#f4f7f0] px-3 py-1 text-sm font-semibold">{applicationLabel(application.status)}</span>
        <h2 className="mt-4 break-words text-xl font-semibold">{event?.title ?? "Event currently unavailable"}</h2>
        {event && <><p className="mt-3 text-sm">{eventDate(event.starts_at)} · {event.public_area}</p><Link className="mt-3 inline-block text-sm underline" href={`/event/${event.id}`}>View event</Link></>}
        {application.status === "pending" && <p className="mt-4 text-sm text-[#69736c]">Your application is awaiting review.</p>}
        {application.status === "rejected" && <p className="mt-4 text-sm text-[#69736c]">Your application was not approved. You can explore other events.</p>}
        {application.status === "approved" && <section className="mt-6 rounded-xl bg-[#f4f7f0] p-5"><h3 className="font-semibold">Meeting details</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{detailsFailed ? "We couldn’t load your meeting details. Please try again later." : details.get(application.event_id) ?? "Meeting details are not available yet. Please check back later."}</p><p className="mt-3 text-xs text-[#69736c]">For your participation only. Please do not share private meeting information.</p></section>}
      </article>;
    })}</div>}
    <Link href="/account" className="mt-8 inline-block underline">← My Account</Link>
  </EventShell>;
}
