import { LocalContentDetail } from "@/components/local-content";
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LocalContentDetail kind="places" id={id} />;
}
