import { InformationPage } from "@/components/information-page";
import { informationPages } from "@/lib/information-pages";

export const metadata = { title: informationPages.about.title, description: informationPages.about.intro };
export default function Page() { return <InformationPage page="about" />; }
