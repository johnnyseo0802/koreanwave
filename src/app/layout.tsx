import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Korean Wave Community — Discover Korea Beyond the Screen", template: "%s | Korean Wave Community" },
  description: "Discover Korean culture, explore local Korea, and connect with people who love Korea.",
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
