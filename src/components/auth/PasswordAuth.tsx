"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { Turnstile, type TurnstileHandle } from "@/components/auth/Turnstile";
import type { AuthMode } from "@/components/auth/AuthPage";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Email + password sign-up/sign-in. Sign-up success never distinguishes a
 * brand-new email from one that already has an Account — Supabase itself
 * returns the same no-error response for both (an obfuscated user, no mail
 * sent, for the collision case), so rendering the same confirmation copy
 * for every non-error result is what keeps this from leaking Account
 * existence. See spec §Existing-email collision.
 */
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
  const turnstileRef = useRef<TurnstileHandle>(null);
  const { signUpWithPassword, signInWithPassword } = useAuth();
  const handleCaptchaExpire = useCallback(() => setCaptchaToken(null), []);

  const passwordTooShort =
    password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

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
        // Supabase already returns the same "Invalid login credentials"
        // message whether the email is unknown or the password is wrong —
        // rendered as-is, this stays generic without extra branching.
        setError(authError.message || "Authentication failed");
      } else if (mode === "sign-up") {
        setSignedUp(true);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      // Turnstile tokens are single-use — reset so the next attempt gets a
      // fresh one, whether this attempt succeeded or failed.
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
            onChange={(e) => setPassword(e.target.value)}
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
