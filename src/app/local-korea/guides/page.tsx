import { EditorialListing } from "@/components/editorial-content";

import { publicPageMetadata } from "@/lib/public-metadata";
export const metadata = publicPageMetadata("Local Korea Guides", "/local-korea/guides");

export default function GuidesPage() {
  return <EditorialListing section="local-korea" category="guides" />;
}
