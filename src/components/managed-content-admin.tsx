import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEditorialAdmin } from "@/lib/editorial-admin";
import { managedFields, type ManagedKind, type ManagedRecord } from "@/lib/managed-content";
import { uuidPattern } from "@/lib/editorial";
import { EditorialShell } from "@/components/editorial-content";
import { AdminModerationNav } from "@/components/admin-moderation-nav";
import { ManagedContentForm } from "@/components/managed-content-form";
export async function ManagedContentList({ events = false }: { events?: boolean }) {
  const base = events ? "/admin/events" : "/admin/local-content";
  const client = await requireEditorialAdmin(base);
  const groups = await Promise.all((events ? ["events"] as const : ["places", "experiences"] as const).map(async kind => {
    try {
      const { data, error } = await client.from(kind).select(kind === "events" ? "id,title,status" : "id,name,status").order("published_at", { ascending: false }).limit(100);
      return { kind, items: error ? null : data as unknown as { id: string; name?: string; title?: string; status: string }[] };
    } catch { return { kind, items: null }; }
  }));
  return <EditorialShell title={events ? "Event content" : "Local content"} eyebrow="Administration"><AdminModerationNav active={events ? "events" : "local-content"} /><p className="mb-6 text-sm text-[#69736c]">{events ? "Maintain existing event content. Schedule, creation and private meeting details are managed separately." : "Create or maintain Places and Experiences. Verify practical facts and image rights before publishing."}</p>{groups.map(group => <section key={group.kind} className="mb-8"><h2 className="mb-4 text-2xl font-semibold capitalize">{group.kind}</h2>{!events && <Link href={`${base}/${group.kind}/new`} className="mb-5 inline-block rounded-full bg-[#17201d] px-5 py-3 text-white">Create {group.kind === "places" ? "place" : "experience"}</Link>}{group.items === null ? <p role="alert">Content unavailable. Check the migration and try again.</p> : !group.items.length ? <p>No entries yet.</p> : <ul className="space-y-3">{group.items.map(item => <li key={item.id}><Link href={events ? `${base}/${item.id}` : `${base}/${group.kind}/${item.id}`} className="flex flex-wrap justify-between gap-3 rounded-xl border border-[#e3e7e2] bg-white p-5"><span className="break-words">{item.title ?? item.name}</span><span className="text-sm">{item.status} · Edit →</span></Link></li>)}</ul>}</section>)}</EditorialShell>;
}
export async function ManagedContentEditor({ kind, id }: { kind: ManagedKind; id: string }) {
  const path = kind === "events" ? `/admin/events/${id}` : `/admin/local-content/${kind}/${id}`;
  const client = await requireEditorialAdmin(path);
  if (!uuidPattern.test(id)) notFound();
  let item: ManagedRecord | null = null;
  try {
    const { data, error } = await client.from(kind).select(`id,status,updated_at,image_url,image_alt,${managedFields[kind].join(",")}`).eq("id", id).maybeSingle();
    if (!error) item = data as unknown as ManagedRecord;
  } catch { /* No raw errors or private data. */ }
  if (!item) return <EditorialShell title="Content unavailable" eyebrow="Administration"><p>Check the content migration and reload the list.</p></EditorialShell>;
  return <EditorialShell title={`Edit ${kind === "events" ? "event" : kind === "places" ? "place" : "experience"}`} eyebrow="Administration"><AdminModerationNav active={kind === "events" ? "events" : "local-content"} /><ManagedContentForm kind={kind} item={item} /></EditorialShell>;
}
