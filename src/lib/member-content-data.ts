import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { uuid } from "@/lib/community";
import type { OwnedContent } from "@/lib/member-content";
export const ownContent = cache(async (target?: string): Promise<OwnedContent[] | null> => {
  if (target && !uuid.test(target)) return null;
  try {
    const client=await createClient(), auth=await client.auth.getUser();
    if (auth.error || !auth.data.user) return [];
    const r=await client.rpc("my_manageable_content", { target: target ?? null });
    return r.error ? null : (r.data ?? []) as OwnedContent[];
  } catch { return null; }
});
