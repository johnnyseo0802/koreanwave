import { InformationPage } from "@/components/information-page";
import { informationPages } from "@/lib/information-pages";

import { publicPageMetadata } from "@/lib/public-metadata";
export const metadata = publicPageMetadata(informationPages.privacy.title, "/privacy", informationPages.privacy.intro);
export default function Page() { return <InformationPage page="privacy" />; }
