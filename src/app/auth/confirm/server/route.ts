import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CONFIRMED_PATH = "/auth/confirmed";
const FAILED_PATH = "/auth/confirmation-failed";

/**
 * Server-side callback for a future TokenHash email template or PKCE code flow.
 * The default ConfirmationURL can return a PKCE code or browser session fragment;
 * /auth/confirm/page.tsx forwards codes here and handles fragments in the browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const redirectTo = request.nextUrl.clone();

  redirectTo.pathname = FAILED_PATH;
  redirectTo.search = "";
  redirectTo.hash = "";

  try {
    const supabase = await createClient();
    if (tokenHash && (type === "signup" || type === "email")) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) redirectTo.pathname = CONFIRMED_PATH;
    } else if (code && !tokenHash) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) redirectTo.pathname = CONFIRMED_PATH;
    }
  } catch {
    // Fixed failure destination; never forward raw Auth errors or query values.
  }
  const response = NextResponse.redirect(redirectTo);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
