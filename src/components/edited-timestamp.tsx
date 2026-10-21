"use client";
import { useSyncExternalStore } from "react";
const subscribe=()=>()=>{};
const client=()=>true, server=()=>false;
/** Browser locale AND timezone; never infer editing from updated_at. */
export function EditedTimestamp({ value }: { value?: string | null }) {
  const hydrated=useSyncExternalStore(subscribe,client,server);
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return <time dateTime={value} className="mt-2 block text-xs text-[#69736c]" title={hydrated?new Date(value).toLocaleString():undefined}>
    {hydrated ? `Edited ${new Intl.DateTimeFormat(undefined,{dateStyle:"medium"}).format(new Date(value))} · ${new Intl.DateTimeFormat(undefined,{timeStyle:"short"}).format(new Date(value))}` : "Edited"}
  </time>;
}
