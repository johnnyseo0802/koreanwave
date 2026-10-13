import { publicPageMetadata } from "@/lib/public-metadata";
export const metadata = publicPageMetadata("K-Contents", "/k-contents");

import { EditorialListing } from "@/components/editorial-content";

export default function Page() {
  return <EditorialListing section="k-contents" />;
}
