import { notFound, redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { AdminModerationNav } from "@/components/admin-moderation-nav";
import { ApplicationModerationQueue, type PendingApplication } from "@/components/application-moderation-queue";
import { EventShell } from "@/components/event-shell";
import { eventDate } from "@/lib/events";

export default async function AdminEventApplicationsPage() {
  const access = await getAdminAccess();
  if (access.status === "unauthenticated") redirect("/login?next=/admin/event-applications");
  if (access.status !== "admin") notFound();
  let applications: PendingApplication[] | null = null;
  try {
    const { data, error } = await access.client.from("event_applications")
      .select("id,event_id,status,created_at").eq("status", "pending")
      .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(100);
    if (error) throw new Error("Queue unavailable");
    const rows = data ?? [];
    const events = new Map<string, { title: string; starts_at: string; public_area: string }>();
    if (rows.length) {
      const context = await access.client.from("events").select("id,title,starts_at,public_area")
        .in("id", [...new Set(rows.map((row) => row.event_id))]).eq("status", "published");
      if (context.error) throw new Error("Context unavailable");
      for (const event of context.data ?? []) events.set(event.id, event);
    }
    applications = rows.map((row) => {
      const event = events.get(row.event_id);
      return { id: row.id, status: row.status, created_at: row.created_at,
        event_title: event?.title ?? "Event currently unavailable",
        event_context: event ? `${eventDate(event.starts_at)} · ${event.public_area}` : "Approval requires an upcoming published event. Rejection remains available.",
      };
    });
  } catch { /* No application/member identity or raw error output. */ }
  return <EventShell title="Event applications">
    <AdminModerationNav active="event-applications" />
    <p className="text-sm leading-7 text-[#69736c]">Review up to 100 oldest pending applications. Decisions are final in this MVP. Approval grants access to private meeting details.</p>
    {applications ? <ApplicationModerationQueue applications={applications} /> : <p role="alert" className="mt-6">We couldn’t load the queue. Please refresh or try again later.</p>}
  </EventShell>;
}
