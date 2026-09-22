"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CONFIRMED_PATH = "/auth/confirmed";
const FAILED_PATH = "/auth/confirmation-failed";

/**
 * Handles the session fragment produced by Supabase's default ConfirmationURL.
 * URL fragments are browser-only, so this cannot be a Route Handler.
 */
export default function DefaultEmailConfirmationPage() {
  const router = useRouter();
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }

    hasStarted.current = true;

    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    const hasFragment = window.location.hash.length > 1;

    async function confirmDefaultEmailLink() {
      let destination = FAILED_PATH;

      try {
        if (hasFragment) {
          const supabase = createClient();
          const { data, error } = await supabase.auth.getSession();

          if (!error && data.session) {
            destination = CONFIRMED_PATH;
          }
        }
      } catch {
        // A malformed or expired link proceeds to the existing failure screen.
      } finally {
        // Do not leave authentication fragments in browser history or the address bar.
        window.history.replaceState(null, "", cleanUrl);
        router.replace(destination);
      }
    }

    void confirmDefaultEmailLink();
  }, [router]);

  return <main className="flex min-h-screen items-center justify-center bg-[#fcfcfa] px-5 text-[#18201d]"><p className="text-sm text-[#69736c]" role="status">Confirming your email…</p></main>;
}
