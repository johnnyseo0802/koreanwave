import { publicPageMetadata } from "@/lib/public-metadata";
export const metadata = publicPageMetadata("K-Fashion", "/k-trends/fashion");

import { EditorialListing } from "@/components/editorial-content";

export default function Page() {
  return <EditorialListing section="k-trends" category="fashion" />;
}
