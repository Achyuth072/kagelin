"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2 } from "lucide-react";
import { Turnstile } from "@/components/auth/Turnstile";
import type { AuthMode } from "@/components/auth/AuthPage";
import { AUTH_LINK_CLASS } from "@/components/auth/authLinkClass";
import { AuthEmailField } from "@/components/auth/AuthEmailField";
import { AuthConfirmationCard } from "@/components/auth/AuthConfirmationCard";
import { PasswordBreachWarning } from "@/components/auth/PasswordBreachWarning";
import { PasswordVisibilityToggle } from "@/components/auth/PasswordVisibilityToggle";
import { useTurnstileCaptcha } from "@/lib/hooks/useTurnstileCaptcha";
import { usePasswordBreachCheck } from "@/lib/hooks/usePasswordBreachCheck";
import {
  MIN_PASSWORD_LENGTH,
  isPasswordTooShort,
} from "@/lib/auth/password-policy";
import {
  SIGNUP_DISABLED_MESSAGE,
  isSignupDisabledError,
} from "@/lib/auth/format-auth-error";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Same confirmation copy for every sign-up success — Supabase gives no
// signal to distinguish a new email from an already-registered one.
export function PasswordAuth({
  mode,
  onSwitchToSignIn,
  onForgotPassword,
  onSwitchToMagicLink,
}: {
  mode: AuthMode;
  onSwitchToSignIn: () => void;
  onForgotPassword?: () => void;
  onSwitchToMagicLink?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedUp, setSignedUp] = useState(false);
  const {
    captchaToken,
    setCaptchaToken,
    turnstileRef,
    handleCaptchaExpire,
    resetCaptcha,
  } = useTurnstileCaptcha();
  const { breached, checkOnBlur, clearBreach } = usePasswordBreachCheck();
  const { signUpWithPassword, signInWithPassword } = useAuth();

  const passwordTooShort = isPasswordTooShort(password);
  const showForgotPassword = mode === "sign-in" && !!onForgotPassword;

  const handlePasswordBlur = () => {
    checkOnBlur(password, mode !== "sign-up" || passwordTooShort);
  };

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
        const message = authError.message || "Authentication failed";
        setError(
          isSignupDisabledError(message) ? SIGNUP_DISABLED_MESSAGE : message,
        );
      } else if (mode === "sign-up") {
        setSignedUp(true);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      resetCaptcha();
      setLoading(false);
    }
  };

  if (signedUp) {
    return (
      <AuthConfirmationCard
        motionKey="collision-message"
        title="Check your inbox"
        description={
          <>
            {"If "}
            <span className="font-medium text-foreground">{email}</span>
            {
              " is new, we've sent a link to finish setting up your account. Already have an account? Sign in instead."
            }
          </>
        }
        actionLabel="Sign in instead"
        onAction={onSwitchToSignIn}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <AuthEmailField
        id="password-auth-email"
        value={email}
        onChange={setEmail}
        disabled={loading}
      />

      <div className="space-y-2">
        <Label htmlFor="password-auth-password" className="text-[13px]">
          Password
        </Label>
        <div className="relative">
          <Lock
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            strokeWidth={2.25}
          />
          <Input
            id="password-auth-password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            className="pl-9 pr-9 h-11 text-base md:text-base"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearBreach();
            }}
            onBlur={handlePasswordBlur}
            disabled={loading}
            autoComplete={
              mode === "sign-up" ? "new-password" : "current-password"
            }
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
          <PasswordVisibilityToggle
            visible={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
          />
        </div>
        {passwordTooShort && (
          <p className="text-xs text-muted-foreground">
            Password must be at least {MIN_PASSWORD_LENGTH} characters.
          </p>
        )}
        <PasswordBreachWarning breached={breached} />
        {(showForgotPassword || onSwitchToMagicLink) && (
          <div className="flex items-center justify-between gap-4">
            {showForgotPassword && (
              <button
                type="button"
                onClick={onForgotPassword}
                className={AUTH_LINK_CLASS}
              >
                Forgot password?
              </button>
            )}
            {onSwitchToMagicLink && (
              <button
                type="button"
                onClick={onSwitchToMagicLink}
                className={AUTH_LINK_CLASS}
              >
                Email me a link instead
              </button>
            )}
          </div>
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
