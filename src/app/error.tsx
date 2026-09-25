"use client";
import Link from "next/link";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // Never render or log the raw error: it can contain internal service details.
  return <main id="main-content" className="mx-auto max-w-3xl px-5 py-20 text-[#18201d]"><h1 className="text-3xl font-semibold">We couldn’t load this page.</h1><p className="mt-5 leading-7 text-[#626c66]">Please try again. If you were saving something, check its current state before resubmitting.</p><div className="mt-8 flex flex-wrap gap-4"><button onClick={retry} className="rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white">Try again</button><Link href="/" className="rounded-full border border-[#dce2dc] px-5 py-3 text-sm font-semibold">Back home</Link></div></main>;
}
