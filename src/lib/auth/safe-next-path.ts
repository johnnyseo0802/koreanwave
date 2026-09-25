/**
 * Accept plain internal path segments only. Queries/fragments and encoded paths
 * are deliberately unsupported for now; invalid destinations return home.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*$/.test(value)) return "/";
  return value;
}
