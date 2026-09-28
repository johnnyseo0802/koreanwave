export const metadata = { title: "Places" };

import { LocalContentList } from "@/components/local-content";
export default async function PlacesPage({ searchParams }: { searchParams: Promise<{ area?: string | string[] }> }) { return <LocalContentList kind="places" filter={(await searchParams).area} />; }
