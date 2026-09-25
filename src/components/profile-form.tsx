"use client";

import { useRef, useState, type FormEvent } from "react";
import { saveProfile } from "@/app/account/actions";
import { characterCount, validateProfile, type EditableProfile } from "@/lib/profile";

const inputClass = "mt-2 w-full rounded-xl border border-[#e0e5e0] bg-white px-4 py-3 text-sm outline-none focus:border-[#789a50] focus:ring-2 focus:ring-[#dbe4d7]";

export function ProfileForm({ initialProfile }: { initialProfile: EditableProfile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const submitting = useRef(false);

  function change(field: keyof EditableProfile, value: string) {
    setProfile((previous) => ({ ...previous, [field]: value }));
    setFeedback(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const validation = validateProfile(profile);
    if (validation) { setFeedback({ ok: false, message: validation }); return; }
    const formData = new FormData(event.currentTarget);
    submitting.current = true;
    setPending(true);
    setFeedback(null);
    try {
      const result = await saveProfile(formData);
      setFeedback({ ok: result.ok, message: result.message });
      if (result.ok && result.profile) setProfile(result.profile);
    } catch {
      setFeedback({ ok: false, message: "We couldn’t save your profile. Please check your connection and try again." });
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return <section id="profile" className="mt-10 scroll-mt-6 rounded-[2rem] border border-[#e3e7e2] bg-white p-7 sm:p-10">
    <h2 className="text-xl font-semibold">Profile</h2>
    <p className="mt-3 text-sm leading-6 text-[#717a74]">Make this space yours. Update your basic profile details below.</p>
    <form onSubmit={submit} className="mt-6" aria-busy={pending}>
      <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium" htmlFor="profile-name">Display name<input id="profile-name" name="display_name" autoComplete="nickname" className={inputClass} value={profile.display_name} onChange={(event) => change("display_name", event.target.value)} /><span className="mt-1 block text-xs text-[#717a74]">Up to 80 characters.</span></label>
        <label className="text-sm font-medium" htmlFor="profile-country">Country<input id="profile-country" name="country" autoComplete="country-name" className={inputClass} value={profile.country} onChange={(event) => change("country", event.target.value)} /><span className="mt-1 block text-xs text-[#717a74]">Up to 80 characters.</span></label>
        <label className="text-sm font-medium" htmlFor="profile-language">Preferred language<select id="profile-language" name="preferred_language" className={inputClass} value={profile.preferred_language} onChange={(event) => change("preferred_language", event.target.value)}><option value="en">English</option><option value="ko">Korean</option></select></label>
        <label className="text-sm font-medium sm:col-span-2" htmlFor="profile-bio">Bio<textarea id="profile-bio" name="bio" rows={5} className={inputClass} value={profile.bio} aria-describedby="bio-count" aria-invalid={characterCount(profile.bio) > 500} onChange={(event) => change("bio", event.target.value)} /><span id="bio-count" className="mt-1 block text-xs text-[#717a74]">{characterCount(profile.bio)} / 500 characters</span></label>
      </fieldset>
      {feedback && <p role={feedback.ok ? "status" : "alert"} className={`mt-4 rounded-xl p-3 text-sm ${feedback.ok ? "bg-[#f4f7f0] text-[#3d5630]" : "bg-[#fdf0ed] text-[#a1432d]"}`}>{feedback.message}</p>}
      <button type="submit" disabled={pending} className="mt-6 rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">{pending ? "Saving…" : "Save profile"}</button>
    </form>
  </section>;
}
