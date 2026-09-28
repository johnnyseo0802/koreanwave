"use server";
import { getAdminAccess } from "@/lib/auth/admin-access";
import { uuidPattern } from "@/lib/editorial";
import { managedKind, validateManaged } from "@/lib/managed-content";
import { revalidatePath } from "next/cache";

export async function saveManaged(kind: unknown, id: unknown, revision: unknown, form: FormData) {
  const access = await getAdminAccess();
  if (access.status !== "admin") return { ok: false, message: "Administrator access could not be verified." };
  if (!managedKind(kind) || typeof id !== "string" || !uuidPattern.test(id) || typeof revision !== "string" || revision.length > 64 || !Number.isFinite(Date.parse(revision)) || !(form instanceof FormData)) return { ok: false, message: "Reload the editor before saving." };
  const checked = validateManaged(kind, form);
  if (!checked.value) return { ok: false, message: checked.error ?? "Check the content fields." };
  try {
    // Fixed table allowlist + explicit field whitelist. No timestamps/identities/dates.
    const { data, error } = await access.client.from(kind).update(checked.value).eq("id", id).eq("updated_at", revision).select("id,updated_at").maybeSingle();
    if (error) return { ok: false, message: "Save unavailable. Check access and the content migration, then retry." };
    if (!data) return { ok: false, message: "This item changed or is unavailable. Reload before saving." };
    revalidatePath("/", "layout");
    return { ok: true, revision: data.updated_at as string, message: checked.value.status === "published" ? "Saved. This content is public." : "Draft saved. This content is hidden from public lists." };
  } catch { return { ok: false, message: "Could not confirm the save. Reload to check the saved version." }; }
}
