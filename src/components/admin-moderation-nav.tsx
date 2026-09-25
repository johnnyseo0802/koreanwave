import Link from "next/link";

// Only rendered after the containing page passes its server-side admin check.
export function AdminModerationNav({ active }: { active: "questions" | "answers" | "reviews" | "event-applications" | "content" }) {
  return <nav aria-label="Moderation" className="mb-8 flex flex-wrap gap-3">
    {(["questions", "answers", "reviews", "event-applications", "content"] as const).map((section) => <Link key={section} href={`/admin/${section}`} aria-current={active === section ? "page" : undefined} className={`rounded-full px-5 py-2 text-sm font-semibold ${active === section ? "bg-[#17201d] text-white" : "border border-[#dce2dc] bg-white text-[#56625a]"}`}>{section === "questions" ? "Questions" : section === "answers" ? "Answers" : section === "reviews" ? "Reviews" : section === "content" ? "Content" : "Event Applications"}</Link>)}
  </nav>;
}
