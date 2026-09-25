export type EditableProfile = {
  display_name: string;
  country: string;
  preferred_language: string;
  bio: string;
};

// PostgreSQL char_length counts Unicode code points, not UTF-16 code units.
export const characterCount = (value: string) => Array.from(value).length;

export function validateProfile(profile: EditableProfile): string | null {
  if (characterCount(profile.display_name.trim()) > 80) return "Display name must be 80 characters or fewer.";
  if (characterCount(profile.country.trim()) > 80) return "Country must be 80 characters or fewer.";
  if (!["en", "ko"].includes(profile.preferred_language)) return "Choose English or Korean.";
  if (characterCount(profile.bio) > 500) return "Bio must be 500 characters or fewer.";
  return null;
}
