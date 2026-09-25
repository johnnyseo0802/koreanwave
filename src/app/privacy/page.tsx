import { InformationPage } from "@/components/information-page";
import { informationPages } from "@/lib/information-pages";

export const metadata = { title: informationPages.privacy.title, description: informationPages.privacy.intro };
export default function Page() { return <InformationPage page="privacy" />; }
