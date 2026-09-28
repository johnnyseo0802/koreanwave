export const metadata = { title: "Experiences" };

import { LocalContentList } from "@/components/local-content";
export default async function ExperiencesPage({ searchParams }: { searchParams: Promise<{ category?: string | string[] }> }) { return <LocalContentList kind="experiences" filter={(await searchParams).category} />; }
