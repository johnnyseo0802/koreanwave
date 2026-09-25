export const metadata = { title: "K-Drama" };

import { EditorialListing } from "@/components/editorial-content";

export default function Page() {
  return <EditorialListing section="k-contents" category="dramas" />;
}
