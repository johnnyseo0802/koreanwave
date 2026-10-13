import { publicPageMetadata } from "@/lib/public-metadata";
export const metadata = publicPageMetadata("K-Food", "/k-trends/food");

import { EditorialListing } from "@/components/editorial-content";

export default function Page() {
  return <EditorialListing section="k-trends" category="food" />;
}
