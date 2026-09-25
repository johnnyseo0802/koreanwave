import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicEventFields, eventDate, applicationLabel, type PublicEvent } from "@/lib/events";
import { applyToEvent } from "@/lib/apply-to-event";
import { EventShell } from "@/components/event-shell";
import { EventApplicationForm } from "@/components/event-application-form";
import { eventRequestTime } from "@/lib/event-request-time";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    try {
      const client = await createClient();
      const { data, error } = await client.from("events").select("title,description")
        .eq("id", id).eq("status", "published").maybeSingle();
      if (!error && data) return { title: data.title, description: data.description.slice(0, 160) };
    } catch { /* Only public content can appear in metadata. */ }
  }
  return { title: "Page unavailable", robots: { index: false } };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  let event: PublicEvent | null = null;
  try {
    const client = await createClient();
    const { data, error } = await client.from("events").select(publicEventFields).eq("id", id).eq("status", "published").maybeSingle();
    if (!error && data) event = data;
  } catch { /* Same public not-found for missing/private/unavailable events. */ }
  if (!event) notFound();
  let authenticated = false;
  let status: string | null = null;
  let applicationReadFailed = false;
  try {
    const client = await createClient();
    const { data: auth, error } = await client.auth.getUser();
    if (!error && auth.user) {
      authenticated = true;
      const own = await client.from("event_applications").select("status")
        .eq("event_id", event.id).eq("member_id", auth.user.id).maybeSingle();
      applicationReadFailed = !!own.error;
      status = own.data?.status ?? null;
    }
  } catch { applicationReadFailed = true; }
  const eventId = event.id;
  async function applyAction() { "use server"; return applyToEvent(eventId); }
  const loginHref = `/login?next=${encodeURIComponent(`/event/${eventId}`)}`;
  const now = await eventRequestTime();
  const closed = Date.parse(event.starts_at) <= now || (!!event.application_deadline && Date.parse(event.application_deadline) <= now);
  return <EventShell title={event.title}>
    <p className="text-sm text-[#557b39]">{event.category} · {event.public_area}</p>
    <p className="mt-3 font-semibold">{eventDate(event.starts_at)}</p>
    <article className="mt-6 rounded-[2rem] border border-[#e3e7e2] bg-white p-7 sm:p-10">
      <p className="whitespace-pre-wrap break-words leading-8 text-[#56625a]">{event.description}</p>
      {event.participation_info && <section className="mt-6"><h2 className="text-xl font-semibold">Before you join</h2><p className="mt-3 whitespace-pre-wrap break-words leading-7">{event.participation_info}</p></section>}
      {event.cancellation_policy && <section className="mt-6"><h2 className="text-xl font-semibold">Cancellation information</h2><p className="mt-3 whitespace-pre-wrap break-words leading-7">{event.cancellation_policy}</p></section>}
      <p className="mt-6 text-sm text-[#69736c]">Please follow the organizer’s guidance and take care of your belongings. Exact meeting details are available in My Events only after your application is approved.</p>
    </article>
    <section className="mt-6 rounded-2xl border border-[#e3e7e2] bg-white p-7"><h2 className="text-xl font-semibold">Participation</h2>
      {event.application_deadline && <p className="mt-3 text-sm">Apply before {eventDate(event.application_deadline)}</p>}
      {applicationReadFailed ? <p role="alert" className="mt-4">We couldn’t check your application. Please refresh or check My Events.</p> : status ? <><p className="mt-4 font-semibold">{applicationLabel(status)}</p><Link className="mt-3 inline-block underline" href="/account/events">My Events / application details</Link></> : closed ? <p className="mt-4">Applications are closed for this event.</p> : authenticated ? <EventApplicationForm applyAction={applyAction} loginHref={loginHref} /> : <Link href={loginHref} className="mt-5 inline-block rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white">Log in to apply</Link>}
    </section>
    <Link href="/events" className="mt-8 inline-block underline">← Back to Events</Link>
  </EventShell>;
}
