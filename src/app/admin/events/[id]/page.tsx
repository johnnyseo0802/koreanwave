import { ManagedContentEditor } from "@/components/managed-content-admin";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <ManagedContentEditor kind="events" id={(await params).id} />; }
