import type { ReactNode } from "react";

// Indexing policy is not access control; page/action authorization remains required.
export const metadata = { robots: { index: false, follow: false } };
export default function Layout({ children }: { children: ReactNode }) { return children; }
