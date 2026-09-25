import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Call before rendering protected content; never trust client UI state. */
export async function requireUser(path: "/account" | "/account/events" | "/write" | "/write/question") {
  let user = null;
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    if (!error) user = data.user;
  } catch {
    // Fail closed without exposing Auth errors or user data.
  }

  // redirect throws; keep it outside the Auth try/catch.
  if (!user) redirect(`/login?next=${path}`);
  return user;
}
