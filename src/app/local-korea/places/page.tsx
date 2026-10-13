import { publicPageMetadata } from "@/lib/public-metadata";
export const metadata = publicPageMetadata("Places", "/local-korea/places");

import { LocalContentList } from "@/components/local-content";
export default async function PlacesPage({ searchParams }: { searchParams: Promise<{ area?: string | string[] }> }) { return <LocalContentList kind="places" filter={(await searchParams).area} />; }
