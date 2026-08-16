"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { PasswordBreachWarning } from "@/components/auth/PasswordBreachWarning";
import { usePasswordBreachCheck } from "@/lib/hooks/usePasswordBreachCheck";
import {
  MIN_PASSWORD_LENGTH,
  isPasswordTooShort,
} from "@/lib/auth/password-policy";

export function UpdatePasswordAuth() {
  const { user, loading, isGuestMode, updatePassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);
  const { breached, checkOnBlur, clearBreach } = usePasswordBreachCheck();

  const passwordTooShort = isPasswordTooShort(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || passwordTooShort) return;

    setSubmitting(true);
    setError(null);

    try {
      const { error: updateError } = await updatePassword(password);
      if (updateError) {
        setError(updateError.message || "Failed to update password");
      } else {
        setUpdated(true);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // No live recovery session — the link is invalid, expired, or already used.
  if (!user || isGuestMode) {
    return (
      <div className="h-dvh w-full flex items-center justify-center px-4 bg-background">
        <div className="max-w-md w-full space-y-4 text-center px-4 py-8 sm:p-8 rounded-2xl border border-border bg-card shadow-sm">
          <h1 className="text-xl font-semibold">Link expired</h1>
          <p className="text-sm text-muted-foreground">
            This password reset link is invalid or has expired. Request a new
            one from the sign-in page.
          </p>
          <Button asChild className="w-full h-11">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh w-full flex items-center justify-center px-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-4 px-4 py-8 sm:p-8 rounded-2xl border border-border bg-card shadow-sm"
      >
        {updated ? (
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2
                className="h-6 w-6 text-primary"
                strokeWidth={2.25}
              />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">Password updated</h1>
              <p className="text-sm text-muted-foreground">
                You can now use your new password to sign in.
              </p>
            </div>
            <Button className="w-full h-11" onClick={() => router.push("/")}>
              Continue
            </Button>
          </div>
        ) : (
          <>
            <div className="text-center space-y-1">
              <h1 className="text-xl font-semibold">Choose a new password</h1>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="update-password-new"
                  className="text-sm font-medium leading-none"
                >
                  New password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    strokeWidth={2.25}
                  />
                  <Input
                    id="update-password-new"
                    type="password"
                    placeholder="••••••••"
                    className="pl-9 h-11 text-base md:text-base"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearBreach();
                    }}
                    onBlur={() => checkOnBlur(password, passwordTooShort)}
                    disabled={submitting}
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                  />
                </div>
                {passwordTooShort && (
                  <p className="text-xs text-muted-foreground">
                    Password must be at least {MIN_PASSWORD_LENGTH} characters.
                  </p>
                )}
                <PasswordBreachWarning breached={breached} />
              </div>

              {error && (
                <p
                  role="alert"
                  className="text-sm text-destructive font-medium"
                >
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-base font-medium"
                disabled={submitting || !password || passwordTooShort}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
