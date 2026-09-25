import { InformationPage } from "@/components/information-page";
import { informationPages } from "@/lib/information-pages";

export const metadata = { title: informationPages.safety.title, description: informationPages.safety.intro };
export default function Page() { return <InformationPage page="safety" />; }
