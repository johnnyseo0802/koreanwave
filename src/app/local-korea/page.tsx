export const metadata = { title: "Discover Local Korea" };

import Link from "next/link";
import { LocalPageShell } from "@/components/local-content";
export default function LocalKoreaPage() {
  return <LocalPageShell title="Discover Local Korea" description="Go beyond the guidebook. Find local places, discover cultural experiences, and connect through events.">
    <div className="grid gap-5 sm:grid-cols-3">{[
      ["Places", "Find neighborhoods, cafés, and places worth a visit. Read visitor information and share a review.", "/local-korea/places"],
      ["Experiences", "Explore local culture and hands-on activities before planning your visit.", "/local-korea/experiences"],
      ["Events", "Discover cultural gatherings and community events across Korea.", "/events"],
    ].map(([title, description, href]) => <Link key={href} href={href} className="rounded-[2rem] border border-[#e3e7e2] bg-white p-7 hover:shadow-lg">
      <div aria-hidden="true" className="mb-6 h-28 rounded-xl bg-gradient-to-br from-[#dceee4] to-[#ffe1c7]" />
      <h2 className="text-2xl font-semibold">{title} →</h2><p className="mt-3 text-sm leading-7 text-[#69736c]">{description}</p>
    </Link>)}</div>
  </LocalPageShell>;
}
