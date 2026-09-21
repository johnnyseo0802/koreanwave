import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Korean Wave Community",
  description: "Discover Korean culture, explore local Korea, and connect with people who love Korea.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
