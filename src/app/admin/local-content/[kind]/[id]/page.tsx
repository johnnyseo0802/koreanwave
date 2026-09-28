import { notFound } from "next/navigation";
import { ManagedContentEditor } from "@/components/managed-content-admin";
export default async function Page({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (kind !== "places" && kind !== "experiences") notFound();
  return <ManagedContentEditor kind={kind} id={id} />;
}
