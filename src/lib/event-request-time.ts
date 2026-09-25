import "server-only";
import { connection } from "next/server";

// A request-time snapshot for UI eligibility/sorting, never a replacement for
// authoritative DB time checks when inserting or approving an application.
export async function eventRequestTime() {
  await connection();
  return Date.now();
}
