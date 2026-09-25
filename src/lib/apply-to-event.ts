import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationResult } from "@/lib/events";

// Only called from an event detail Server Action capturing its verified page ID.
export async function applyToEvent(eventId: string): Promise<ApplicationResult> {
  try {
    const client = await createClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return { ok: false, loginRequired: true, message: "Please log in again to apply." };
    const { data: event, error } = await client.from("events")
      .select("id,starts_at,application_deadline").eq("id", eventId).eq("status", "published").maybeSingle();
    if (error || !event || Date.parse(event.starts_at) <= Date.now()
      || (event.application_deadline && Date.parse(event.application_deadline) <= Date.now())) {
      return { ok: false, message: "This event is not available for applications." };
    }
    // DB eligibility, defaults, and unique(member_id,event_id) are authoritative.
    // Do not upsert, RETURNING *, or accept client status/identity/timestamps.
    const result = await client.from("event_applications").insert({ event_id: event.id, member_id: auth.user.id });
    if (result.error?.code === "23505") return { ok: false, alreadyApplied: true, message: "You have already applied. Check My Events for your status." };
    if (result.error) return { ok: false, message: "We couldn’t submit your application. Please try again later." };
    return { ok: true, message: "Application submitted." };
  } catch {
    return { ok: false, message: "We couldn’t confirm your application. Check My Events before trying again." };
  }
}
