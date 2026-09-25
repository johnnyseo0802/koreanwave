import { InformationPage } from "@/components/information-page";
import { informationPages } from "@/lib/information-pages";

export const metadata = { title: informationPages.faq.title, description: informationPages.faq.intro };
export default function Page() { return <InformationPage page="faq" />; }
