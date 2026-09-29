import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { postTypes, type PostType } from "@/lib/community";
import { CommunityShell } from "@/components/community-shell";
import { CommunityPostForm } from "@/components/community-post-form";
import { weeklyPrompt } from "@/lib/community-data";
export const metadata = { title: "Share your Korea", robots: { index: false, follow: false } };
export default async function Page({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<{ prompt?: string }> }) {
  const { type } = await params;
  if (!postTypes.includes(type as PostType)) notFound();
  await requireUser(`/write/${type as PostType}`);
  const query = await searchParams;
  const prompt = query.prompt === "weekly" ? await weeklyPrompt() : null;
  return <CommunityShell title={`Share a Korea ${type}`} description="A little of your Korea can make someone else’s journey better."><CommunityPostForm type={type as PostType} prompt={prompt?.prompt} /></CommunityShell>;
}
