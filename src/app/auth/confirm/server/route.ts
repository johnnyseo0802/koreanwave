import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CONFIRMED_PATH = "/auth/confirmed";
const FAILED_PATH = "/auth/confirmation-failed";

/**
 * Server-side callback for a future TokenHash email template or PKCE code flow.
 * Supabase's default ConfirmationURL instead redirects with a browser fragment,
 * which is handled by /auth/confirm/page.tsx.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const redirectTo = request.nextUrl.clone();

  redirectTo.pathname = FAILED_PATH;
  redirectTo.search = "";

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (!error) {
      redirectTo.pathname = CONFIRMED_PATH;
      return NextResponse.redirect(redirectTo);
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      redirectTo.pathname = CONFIRMED_PATH;
      return NextResponse.redirect(redirectTo);
    }
  }

  return NextResponse.redirect(redirectTo);
}
