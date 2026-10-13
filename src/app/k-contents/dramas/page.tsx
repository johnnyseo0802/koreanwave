import { publicPageMetadata } from "@/lib/public-metadata";
export const metadata = publicPageMetadata("K-Drama", "/k-contents/dramas");

import { EditorialListing } from "@/components/editorial-content";

export default function Page() {
  return <EditorialListing section="k-contents" category="dramas" />;
}
