"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import { createClient, isSupabaseBrowserConfigurationError } from "@/lib/supabase/client";

function getLoginErrorMessage(error: AuthError) {
  if (isAuthRetryableFetchError(error)) {
    return "We could not reach the account service. Please check your connection and try again.";
  }

  if (error.code === "email_not_confirmed") {
    return "Please confirm your email address before logging in.";
  }

  if (error.code === "invalid_credentials" || error.status === 400) {
    return "Your email or password is incorrect.";
  }

  if (error.status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  return "We could not log you in right now. Please try again.";
}

function getUnexpectedLoginErrorMessage(error: unknown) {
  if (isSupabaseBrowserConfigurationError(error)) {
    return "Account setup is incomplete. Please try again later.";
  }

  if (isAuthRetryableFetchError(error)) {
    return "We could not reach the account service. Please check your connection and try again.";
  }

  return "We could not start login. Please try again.";
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setErrorMessage("Enter your email address.");
      return;
    }

    if (!password) {
      setErrorMessage("Enter your password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        setErrorMessage(getLoginErrorMessage(error));
        return;
      }

      if (!data.session) {
        setErrorMessage("We could not complete login. Please try again.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(getUnexpectedLoginErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return <form noValidate onSubmit={handleSubmit}><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#789a50]">Welcome back</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">Log in</h2><p className="mt-3 text-sm leading-6 text-[#717a74]">Continue saving the places, stories, and conversations you love.</p><div className="mt-8 space-y-4"><div><label className="mb-2 block text-sm font-medium text-[#3d4941]" htmlFor="login-email">Email address</label><input autoComplete="email" className="w-full rounded-xl border border-[#e0e5e0] px-4 py-3 text-sm outline-none transition focus:border-[#789a50] focus:ring-2 focus:ring-[#dbe4d7]" id="login-email" name="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></div><div><label className="mb-2 block text-sm font-medium text-[#3d4941]" htmlFor="login-password">Password</label><input autoComplete="current-password" className="w-full rounded-xl border border-[#e0e5e0] px-4 py-3 text-sm outline-none transition focus:border-[#789a50] focus:ring-2 focus:ring-[#dbe4d7]" id="login-password" name="password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></div></div>{errorMessage && <p aria-live="polite" className="mt-4 rounded-xl bg-[#fdf0ed] px-4 py-3 text-sm text-[#a1432d]" role="alert">{errorMessage}</p>}<button className="mt-6 w-full rounded-xl bg-[#17201d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2d3c35] disabled:cursor-not-allowed disabled:bg-[#dbe4d7] disabled:text-[#60715c]" disabled={isSubmitting} type="submit">{isSubmitting ? "Logging in…" : "Log in"}</button></form>;
}
