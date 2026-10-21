/** Disclosure is NOT an approval decision. DB triggers classify every write. */
export function publicationDisclosure(form: FormData): "personal" | "commercial" | "unspecified" {
  const value = form.get("commercial_disclosure");
  return value === "personal" || value === "commercial" ? value : "unspecified";
}
export const submissionNotice = "Saved. General contributions are public immediately; commercial or held submissions await review. Check My Contributions for the current status.";
