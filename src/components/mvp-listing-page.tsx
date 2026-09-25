import Link from "next/link";
import { ContentCard, type ContentCardData } from "@/components/content-card";
import { LoginForm } from "@/components/login-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SignupForm } from "@/components/signup-form";

type ListingPageProps = { eyebrow: string; title: string; description: string; cards: ContentCardData[]; action?: { label: string; href: string } };

export function MvpListingPage({ eyebrow, title, description, cards, action }: ListingPageProps) {
  return <main className="min-h-screen bg-[#fcfcfa] text-[#18201d]"><SiteHeader /><section className="border-y border-[#e4e8e1] bg-[#f4f7f0]"><div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-10"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#557b39]">{eyebrow}</p><div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div className="max-w-2xl"><h1 className="text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">{title}</h1><p className="mt-4 text-base leading-7 text-[#69736c]">{description}</p></div>{action && <Link className="w-fit rounded-full bg-[#17201d] px-5 py-3 text-sm font-semibold text-white" href={action.href}>{action.label} →</Link>}</div></div></section><section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10"><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map((card) => <ContentCard card={card} key={card.title} />)}</div></section><SiteFooter /></main>;
}

export function MvpAccountPage({ kind }: { kind: "login" | "signup" }) {
  const isLogin = kind === "login";
  return <main className="min-h-screen bg-[#fcfcfa] text-[#18201d]"><SiteHeader /><section className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1fr_0.85fr] lg:px-10"><div className="rounded-[2rem] bg-[#1c2924] p-7 text-white sm:p-10"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b7d093]">Korean Wave Community</p><h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">{isLogin ? "Welcome back to your Korea." : "Make Korea feel closer."}</h1><p className="mt-5 max-w-md leading-7 text-[#c7d1ca]">{isLogin ? "Return to your profile, event applications, and community." : "Ask questions, share helpful reviews, and meet people who love Korea too."}</p><div className="mt-10 grid gap-3 sm:grid-cols-3">{["Ask a local", "Share reviews", "Join events"].map((item, index) => <div className="rounded-2xl bg-white/10 p-4 text-sm" key={item}><span className="text-[#b7d093]">0{index + 1}</span><p className="mt-5 font-medium">{item}</p></div>)}</div></div><div className="self-center rounded-[2rem] border border-[#e3e7e2] bg-white p-7 sm:p-10">{isLogin ? <LoginForm /> : <SignupForm />}</div></section><SiteFooter /></main>;
}
