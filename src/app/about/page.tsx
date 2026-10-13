import { InformationPage } from "@/components/information-page";
import { informationPages } from "@/lib/information-pages";

import { publicPageMetadata } from "@/lib/public-metadata";
export const metadata = publicPageMetadata(informationPages.about.title, "/about", informationPages.about.intro);
export default function Page() { return <InformationPage page="about" />; }
