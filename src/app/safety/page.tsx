import { InformationPage } from "@/components/information-page";
import { informationPages } from "@/lib/information-pages";

import { publicPageMetadata } from "@/lib/public-metadata";
export const metadata = publicPageMetadata(informationPages.safety.title, "/safety", informationPages.safety.intro);
export default function Page() { return <InformationPage page="safety" />; }
