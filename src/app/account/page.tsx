export const metadata = { title: "My Account" };

import { requireUser } from "@/lib/auth/require-user";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProfileForm } from "@/components/profile-form";
import { createClient } from "@/lib/supabase/server";
import type { EditableProfile } from "@/lib/profile";

export default async function AccountPage() {
  const user = await requireUser("/account");
  let profile: EditableProfile | null = null;
  try {
    const client = await createClient();
    const { data, error } = await client.from("profiles")
      .select("display_name,country,preferred_language,bio").eq("id", user.id).maybeSingle();
    if (!error && data) profile = {
      display_name: data.display_name ?? "", country: data.country ?? "",
      preferred_language: data.preferred_language, bio: data.bio ?? "",
    };
  } catch {
    // Render a safe error instead of an empty editable form that could overwrite data.
  }
  return (
    <main className="min-h-screen bg-[#fcfcfa] text-[#18201d]">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#557b39]">Your community</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">My Account</h1>
        <p className="mt-4 text-base leading-7 text-[#69736c]">You’re logged in. Welcome to your space in Korean Wave Community.</p>
        {profile ? <ProfileForm initialProfile={profile} /> : <p role="alert" className="mt-10 rounded-2xl border border-[#e3e7e2] bg-white p-7 text-sm">We couldn’t load your profile. Please refresh the page or try again later.</p>}
        <nav aria-label="Account shortcuts" className="mt-10 grid gap-4 sm:grid-cols-2">{[
          ["My Events", "Check your applications and approved meeting details.", "/account/events"],
          ["Ask a Local", "Read published questions and share a helpful answer.", "/community/questions"],
          ["Write & contribute", "Submit a question or choose a place to review.", "/write"],
          ["Profile", "Update the private profile information on this page.", "#profile"],
        ].map(([title, description, href]) => <Link key={href} href={href} className="rounded-2xl border border-[#e3e7e2] bg-white p-7"><h2 className="text-xl font-semibold">{title} →</h2><p className="mt-3 text-sm leading-6 text-[#626c66]">{description}</p></Link>)}</nav>
        <p className="mt-6 text-sm leading-6 text-[#626c66]">Questions, answers, and reviews appear publicly after approval. A personal community submissions list is not available yet.</p>
      </section>
      <SiteFooter />
    </main>
  );
}
