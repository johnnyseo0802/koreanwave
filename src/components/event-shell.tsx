import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function EventShell({ title, children }: { title: string; children: ReactNode }) {
  return <main className="min-h-screen bg-[#fcfcfa] text-[#18201d]"><SiteHeader />
    <section className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#557b39]">Local Korea / Events</p>
      <h1 className="mt-4 break-words text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">{title}</h1>
      <div className="mt-8">{children}</div>
    </section><SiteFooter />
  </main>;
}
