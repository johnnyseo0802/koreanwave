import Link from "next/link";

// Only rendered after the containing page passes its server-side admin check.
export function AdminModerationNav({ active }: { active: "questions" | "answers" | "reviews" | "event-applications" | "content" | "local-content" | "events" | "community" | "clusters" | "conversations" }) {
  return <nav aria-label="Moderation" className="mb-8 flex flex-wrap gap-3">
    <Link href="/admin/conversations" aria-current={active === "conversations" ? "page" : undefined} className="rounded-full border px-5 py-2 text-sm font-semibold">Conversations</Link>
    <Link href="/admin/clusters" aria-current={active === "clusters" ? "page" : undefined} className={`rounded-full border px-5 py-2 text-sm font-semibold ${active === "clusters" ? "bg-[#17201d] text-white" : "bg-white"}`}>Clusters</Link>
    <Link href="/admin/community" aria-current={active === "community" ? "page" : undefined} className={`rounded-full px-5 py-2 text-sm font-semibold ${active === "community" ? "bg-[#17201d] text-white" : "border border-[#dce2dc] bg-white"}`}>Community</Link>
    {(["questions", "answers", "reviews", "event-applications", "content", "local-content", "events"] as const).map((section) => <Link key={section} href={`/admin/${section}`} aria-current={active === section ? "page" : undefined} className={`rounded-full px-5 py-2 text-sm font-semibold ${active === section ? "bg-[#17201d] text-white" : "border border-[#dce2dc] bg-white text-[#56625a]"}`}>{section === "questions" ? "Questions" : section === "answers" ? "Answers" : section === "reviews" ? "Reviews" : section === "content" ? "Content" : section === "local-content" ? "Local Content" : section === "events" ? "Event Content" : "Event Applications"}</Link>)}
  </nav>;
}
