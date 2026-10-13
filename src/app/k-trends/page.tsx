import { publicPageMetadata } from "@/lib/public-metadata";
export const metadata = publicPageMetadata("K-Trends", "/k-trends");

import { EditorialListing } from "@/components/editorial-content";

export default function Page() {
  return <EditorialListing section="k-trends" />;
}
