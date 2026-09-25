"use client";

import { FormEvent, useRef, useState } from "react";
import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import { createClient, isSupabaseBrowserConfigurationError } from "@/lib/supabase/client";

const MINIMUM_PASSWORD_LENGTH = 6;

function getSignupErrorMessage(error: AuthError) {
  if (isAuthRetryableFetchError(error)) {
    return "We could not reach the account service. Please check your connection and try again.";
  }

  if (error.code === "weak_password") {
    return "Choose a stronger password with at least 6 characters.";
  }

  if (error.code === "email_address_invalid") {
    return "Enter a valid email address.";
  }

  if (error.code === "over_email_send_rate_limit") {
    return "Please wait a moment before requesting another confirmation email.";
  }

  if (error.code === "user_already_exists" || error.code === "email_exists") {
    return "An account may already exist for this email. Try logging in after confirming your email.";
  }

  if (error.code === "signup_disabled") {
    return "New account creation is currently unavailable. Please try again later.";
  }

  if (error.status === 429) {
    return "Too many requests. Please try again in a few minutes.";
  }

  return "We could not create your account right now. Please try again.";
}

function getUnexpectedSignupErrorMessage(error: unknown) {
  if (isSupabaseBrowserConfigurationError(error)) {
    return "Account setup is incomplete. Please try again later.";
  }

  if (isAuthRetryableFetchError(error)) {
    return "We could not reach the account service. Please check your connection and try again.";
  }

  return "We could not start account creation. Please try again.";
}

export function SignupForm() {
  const submitLock = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    setErrorMessage("");

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setErrorMessage("Enter your email address.");
      return;
    }

    if (!password) {
      setErrorMessage("Enter a password.");
      return;
    }

    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      setErrorMessage("Use a password with at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Your passwords do not match.");
      return;
    }

    submitLock.current = true;
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });

      if (error) {
        setErrorMessage(getSignupErrorMessage(error));
        return;
      }

      setIsComplete(true);
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorMessage(getUnexpectedSignupErrorMessage(error));
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  }

  if (isComplete) {
    return <div aria-live="polite"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#557b39]">Almost there</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">Check your email</h2><p className="mt-3 text-sm leading-6 text-[#717a74]">We sent a confirmation link to your email address. Confirm your account to finish joining the community.</p></div>;
  }

  return <form noValidate onSubmit={handleSubmit}><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#557b39]">Join Korean Wave Community</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">Join free</h2><p className="mt-3 text-sm leading-6 text-[#717a74]">Create an account to ask questions, share reviews, and apply to events.</p><div className="mt-8 space-y-4"><div><label className="mb-2 block text-sm font-medium text-[#3d4941]" htmlFor="signup-email">Email address</label><input autoComplete="email" className="w-full rounded-xl border border-[#e0e5e0] px-4 py-3 text-sm outline-none transition focus:border-[#789a50] focus:ring-2 focus:ring-[#dbe4d7]" id="signup-email" name="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></div><div><label className="mb-2 block text-sm font-medium text-[#3d4941]" htmlFor="signup-password">Password</label><input autoComplete="new-password" className="w-full rounded-xl border border-[#e0e5e0] px-4 py-3 text-sm outline-none transition focus:border-[#789a50] focus:ring-2 focus:ring-[#dbe4d7]" id="signup-password" minLength={MINIMUM_PASSWORD_LENGTH} name="password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /><p className="mt-2 text-xs text-[#8b948d]">Use at least 6 characters.</p></div><div><label className="mb-2 block text-sm font-medium text-[#3d4941]" htmlFor="signup-confirm-password">Confirm password</label><input autoComplete="new-password" className="w-full rounded-xl border border-[#e0e5e0] px-4 py-3 text-sm outline-none transition focus:border-[#789a50] focus:ring-2 focus:ring-[#dbe4d7]" id="signup-confirm-password" name="confirmPassword" onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} /></div></div>{errorMessage && <p aria-live="polite" className="mt-4 rounded-xl bg-[#fdf0ed] px-4 py-3 text-sm text-[#a1432d]" role="alert">{errorMessage}</p>}<button className="mt-6 w-full rounded-xl bg-[#17201d] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2d3c35] disabled:cursor-not-allowed disabled:bg-[#dbe4d7] disabled:text-[#60715c]" disabled={isSubmitting} type="submit">{isSubmitting ? "Creating account…" : "Create account"}</button><p className="mt-5 text-center text-xs text-[#8b948d]">We’ll ask you to confirm your email before you can sign in.</p></form>;
}
