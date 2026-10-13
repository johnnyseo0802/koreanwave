import { InformationPage } from "@/components/information-page";
import { informationPages } from "@/lib/information-pages";

import { publicPageMetadata } from "@/lib/public-metadata";
export const metadata = publicPageMetadata(informationPages.terms.title, "/terms", informationPages.terms.intro);
export default function Page() { return <InformationPage page="terms" />; }
