export type DiscoveryCard = { id: string; title: string; summary: string; href: string; label: string; image_url?: string | null; image_alt?: string | null };
// Only letters/numbers/space/hyphen: no PostgREST filter grammar or LIKE wildcards.
export function searchTerm(value: unknown): string {
  return typeof value === "string" ? Array.from(value.trim()).slice(0, 80).join("").replace(/[^\p{L}\p{N} -]/gu, " ").replace(/\s+/g, " ").trim() : "";
}
export function filterTerm(value: unknown): string {
  return typeof value === "string" && value.length <= 160 ? value.trim() : "";
}
