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

    const query = new URLSearchParams(window.location.search);
    // Default PKCE emails can return code; retain the existing server verifier.
    if (query.has("code") || query.has("token_hash")) {
      const allowed = new URLSearchParams();
      for (const name of ["code", "token_hash", "type"]) {
        const value = query.get(name);
        if (value) allowed.set(name, value);
      }
      window.history.replaceState(null, "", window.location.pathname);
      window.location.replace(`/auth/confirm/server?${allowed.toString()}`);
      return;
    }
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get("access_token");
    const validFragment = !!accessToken && !!fragment.get("refresh_token") && !fragment.has("error") && !fragment.has("error_code");

    async function confirmDefaultEmailLink() {
      let destination = FAILED_PATH;

      try {
        if (validFragment) {
          const supabase = createClient();
          // The SDK consumes/stores the default fragment. Verify its actual access
          // token, not an unrelated pre-existing browser session or cookie user.
          const { data, error } = await supabase.auth.getUser(accessToken!);

          if (!error && data.user?.email_confirmed_at) {
            destination = CONFIRMED_PATH;
          }
        }
      } catch {
        // A malformed or expired link proceeds to the existing failure screen.
      } finally {
        // Do not leave authentication fragments in browser history or the address bar.
        window.history.replaceState(null, "", window.location.pathname);
        router.replace(destination);
      }
    }

    void confirmDefaultEmailLink();
  }, [router]);

  return <main className="flex min-h-screen items-center justify-center bg-[#fcfcfa] px-5 text-[#18201d]"><p className="text-sm text-[#69736c]" role="status">Confirming your email…</p></main>;
}
