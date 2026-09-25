"use server";

import { getAdminAccess } from "@/lib/auth/admin-access";

export async function moderateAnswer(id: unknown, decision: unknown): Promise<{ ok: boolean; message: string }> {
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    || (decision !== "approved" && decision !== "rejected")) {
    return { ok: false, message: "Please select a valid answer and decision." };
  }
  const access = await getAdminAccess();
  if (access.status !== "admin") {
    return { ok: false, message: "We couldn’t verify administrator access. Please sign in with an authorized account and try again." };
  }
  try {
    // Normal cookie session + RLS; the database owns published_at.
    const { data, error } = await access.client.from("answers")
      .update({ status: decision }).eq("id", id).eq("status", "pending")
      .select("id").maybeSingle();
    if (error) return { ok: false, message: "We couldn’t save this decision. Refresh the queue and try again." };
    if (!data) return { ok: false, message: "This answer is no longer available for moderation. Please refresh the queue." };
    return { ok: true, message: decision === "approved" ? "Answer approved." : "Answer rejected." };
  } catch {
    return { ok: false, message: "We couldn’t confirm this decision. Refresh the queue before trying again." };
  }
}
