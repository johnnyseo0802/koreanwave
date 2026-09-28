import { LocalContentDetail } from "@/components/local-content";
import { getLocalItem } from "@/lib/discovery-data";
import { publicMetadata } from "@/lib/public-metadata";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getLocalItem("experiences", id);
  return item ? publicMetadata(item.name, item.description, `/local-korea/experiences/${id}`, item.image_url, item.image_alt) : { title: "Page unavailable", robots: { index: false } };
}
export default async function DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LocalContentDetail kind="experiences" id={id} />;
}
