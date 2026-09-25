import { InformationPage } from "@/components/information-page";
import { informationPages } from "@/lib/information-pages";

export const metadata = { title: informationPages.contact.title, description: informationPages.contact.intro };
export default function Page() { return <InformationPage page="contact" />; }
