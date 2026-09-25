export const metadata = { title: "K-Movie" };

import { EditorialListing } from "@/components/editorial-content";

export default function Page() {
  return <EditorialListing section="k-contents" category="movies" />;
}
