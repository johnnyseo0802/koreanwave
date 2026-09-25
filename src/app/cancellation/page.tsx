import { InformationPage } from "@/components/information-page";
import { informationPages } from "@/lib/information-pages";

export const metadata = { title: informationPages.cancellation.title, description: informationPages.cancellation.intro };
export default function Page() { return <InformationPage page="cancellation" />; }
