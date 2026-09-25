export type PublicEvent = {
  id: string; title: string; description: string; public_area: string; category: string;
  starts_at: string; application_deadline: string | null;
  participation_info: string | null; cancellation_policy: string | null;
};
export const publicEventFields = "id,title,description,public_area,category,starts_at,application_deadline,participation_info,cancellation_policy";
export function eventDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value)) + " KST";
}
export function applicationLabel(status: string) {
  return status === "approved" ? "Application approved" : status === "rejected" ? "Application not approved" : "Application pending";
}
export type ApplicationResult = { ok: boolean; message: string; loginRequired?: boolean; alreadyApplied?: boolean };
