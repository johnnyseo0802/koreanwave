import { publicPageMetadata } from "@/lib/public-metadata";
export const metadata = publicPageMetadata("Music & K-Pop", "/k-contents/music");

import { EditorialListing } from "@/components/editorial-content";

export default function Page() {
  return <EditorialListing section="k-contents" category="music" />;
}
