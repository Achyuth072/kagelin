"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { Turnstile, type TurnstileHandle } from "@/components/auth/Turnstile";
import type { AuthMode } from "@/components/auth/AuthPage";
import { isPasswordBreached } from "@/lib/auth/password-breach-check";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const MIN_PASSWORD_LENGTH = 8;

// Same confirmation copy for every sign-up success — Supabase gives no
// signal to distinguish a new email from an already-registered one.
export function PasswordAuth({
  mode,
  onSwitchToSignIn,
}: {
  mode: AuthMode;
  onSwitchToSignIn: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedUp, setSignedUp] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [breached, setBreached] = useState(false);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const lastCheckedPasswordRef = useRef<string | null>(null);
  const { signUpWithPassword, signInWithPassword } = useAuth();
  const handleCaptchaExpire = useCallback(() => setCaptchaToken(null), []);

  const passwordTooShort =
    password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

  // Blur, not keystroke, so the HIBP prefix doesn't narrow with every
  // character typed. lastCheckedPasswordRef dedupes and guards against a
  // stale response overwriting a newer check's result.
  const handlePasswordBlur = useCallback(() => {
    if (mode !== "sign-up" || passwordTooShort || password.length === 0) {
      return;
    }
    if (lastCheckedPasswordRef.current === password) return;
    lastCheckedPasswordRef.current = password;

    isPasswordBreached(password)
      .then((result) => {
        if (lastCheckedPasswordRef.current === password) setBreached(result);
      })
      .catch(() => {
        if (lastCheckedPasswordRef.current === password) setBreached(false);
      });
  }, [mode, password, passwordTooShort]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || passwordTooShort || !captchaToken) return;

    setLoading(true);
    setError(null);

    try {
      const { error: authError } =
        mode === "sign-up"
          ? await signUpWithPassword(email, password, captchaToken)
          : await signInWithPassword(email, password, captchaToken);

      if (authError) {
        // Supabase's message is already generic re: email-vs-password.
        setError(authError.message || "Authentication failed");
      } else if (mode === "sign-up") {
        setSignedUp(true);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      // Turnstile tokens are single-use.
      setCaptchaToken(null);
      turnstileRef.current?.reset();
      setLoading(false);
    }
  };

  if (signedUp) {
    return (
      <motion.div
        key="collision-message"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full flex flex-col items-center justify-center p-6 text-center space-y-4 rounded-lg bg-primary/5 border border-primary/20"
      >
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6 text-primary" strokeWidth={2.25} />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">Check your inbox</h3>
          <p className="text-sm text-muted-foreground max-w-[260px] mx-auto">
            If <span className="font-medium text-foreground">{email}</span> is
            new, we&apos;ve sent a link to finish setting up your account.
            Already have an account? Sign in instead.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSwitchToSignIn}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Sign in instead
        </Button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="password-auth-email"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Email address
        </label>
        <div className="relative">
          <Mail
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            strokeWidth={2.25}
          />
          <Input
            id="password-auth-email"
            type="email"
            placeholder="name@example.com"
            className="pl-9 h-11 text-base md:text-base"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="password-auth-password"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Password
        </label>
        <div className="relative">
          <Lock
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            strokeWidth={2.25}
          />
          <Input
            id="password-auth-password"
            type="password"
            placeholder="••••••••"
            className="pl-9 h-11 text-base md:text-base"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setBreached(false);
            }}
            onBlur={handlePasswordBlur}
            disabled={loading}
            autoComplete={
              mode === "sign-up" ? "new-password" : "current-password"
            }
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </div>
        {passwordTooShort && (
          <p className="text-xs text-muted-foreground">
            Password must be at least {MIN_PASSWORD_LENGTH} characters.
          </p>
        )}
        {breached && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            This password has appeared in known data breaches. You can still use
            it, but choosing a different one is safer.
          </p>
        )}
      </div>

      {TURNSTILE_SITE_KEY && (
        <Turnstile
          siteKey={TURNSTILE_SITE_KEY}
          onVerify={setCaptchaToken}
          onExpire={handleCaptchaExpire}
          handleRef={turnstileRef}
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive font-medium">
          {error}
        </p>
      )}

      <Button
        type="submit"
        className="w-full h-11 text-base font-medium transition-all"
        disabled={
          loading ||
          !email ||
          !password ||
          passwordTooShort ||
          (!!TURNSTILE_SITE_KEY && !captchaToken)
        }
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {mode === "sign-up" ? "Creating account..." : "Signing in..."}
          </>
        ) : mode === "sign-up" ? (
          "Create account"
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
