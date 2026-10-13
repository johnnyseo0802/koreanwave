import { publicPageMetadata } from "@/lib/public-metadata";
export const metadata = publicPageMetadata("K-Beauty", "/k-trends/beauty");

import { EditorialListing } from "@/components/editorial-content";

export default function Page() {
  return <EditorialListing section="k-trends" category="beauty" />;
}
