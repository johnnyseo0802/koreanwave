import { InformationPage } from "@/components/information-page";
import { informationPages } from "@/lib/information-pages";

import { publicPageMetadata } from "@/lib/public-metadata";
export const metadata = publicPageMetadata(informationPages.contact.title, "/contact", informationPages.contact.intro);
export default function Page() { return <InformationPage page="contact" />; }
