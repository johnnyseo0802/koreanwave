import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { AuthProvider } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

// Every page contains a session-aware header. Never ISR/cache a user's response.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL("https://koreanwave-kappa.vercel.app"),
  title: { default: `${brand.name} — ${brand.tagline}`, template: `%s | ${brand.name}` },
  description: brand.description,
  openGraph: { title: `${brand.name} — ${brand.headline}`, description: brand.description, siteName: brand.name },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  let authenticated = false;
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    authenticated = !error && Boolean(data.user);
  } catch {
    // Public pages remain available during an Auth service outage.
  }
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col"><a href="#main-content" className="skip-link">Skip to content</a><AuthProvider initialAuthenticated={authenticated}>{children}</AuthProvider></body>
    </html>
  );
}
