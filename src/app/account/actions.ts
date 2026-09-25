"use server";

import { createClient } from "@/lib/supabase/server";
import { validateProfile, type EditableProfile } from "@/lib/profile";

export async function saveProfile(formData: FormData): Promise<{ ok: boolean; message: string; profile?: EditableProfile }> {
  try {
    const client = await createClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return { ok: false, message: "Your session has expired. Please log in again." };

    // Explicit allowlist: never accept an ID, role, timestamp, or avatar from the form.
    const displayName = formData.get("display_name");
    const country = formData.get("country");
    const language = formData.get("preferred_language");
    const bio = formData.get("bio");
    if (typeof displayName !== "string" || typeof country !== "string" || typeof language !== "string" || typeof bio !== "string") {
      return { ok: false, message: "Please check the profile fields and try again." };
    }
    const profile = { display_name: displayName.trim(), country: country.trim(), preferred_language: language, bio };
    const validation = validateProfile(profile);
    if (validation) return { ok: false, message: validation };

    const { data, error } = await client.from("profiles").update({
      display_name: profile.display_name || null,
      country: profile.country || null,
      preferred_language: profile.preferred_language,
      bio: profile.bio || null,
    }).eq("id", auth.user.id).select("display_name,country,preferred_language,bio").maybeSingle();

    // A missing row/RLS-denied update must never be reported as successful.
    if (error || !data) return { ok: false, message: "We couldn’t save your profile. Please try again later." };
    return { ok: true, message: "Your profile has been saved.", profile: {
      display_name: data.display_name ?? "", country: data.country ?? "",
      preferred_language: data.preferred_language, bio: data.bio ?? "",
    } };
  } catch {
    return { ok: false, message: "We couldn’t save your profile. Please check your connection and try again." };
  }
}
