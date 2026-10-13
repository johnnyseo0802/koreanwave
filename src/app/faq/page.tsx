import { InformationPage } from "@/components/information-page";
import { informationPages } from "@/lib/information-pages";

import { publicPageMetadata } from "@/lib/public-metadata";
export const metadata = publicPageMetadata(informationPages.faq.title, "/faq", informationPages.faq.intro);
export default function Page() { return <InformationPage page="faq" />; }
