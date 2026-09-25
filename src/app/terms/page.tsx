import { InformationPage } from "@/components/information-page";
import { informationPages } from "@/lib/information-pages";

export const metadata = { title: informationPages.terms.title, description: informationPages.terms.intro };
export default function Page() { return <InformationPage page="terms" />; }
