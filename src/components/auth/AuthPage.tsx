"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MagicLinkAuth } from "@/components/auth/MagicLinkAuth";
import { PasswordAuth } from "@/components/auth/PasswordAuth";
import { ResetPasswordAuth } from "@/components/auth/ResetPasswordAuth";
import { OAuthProviderRow } from "@/components/auth/OAuthProviderRow";
import { slideUp } from "@/lib/motion";
import { PRIVACY_URL, TERMS_URL } from "@/lib/links";

export type AuthMode = "sign-in" | "sign-up";

const MODE_COPY: Record<
  AuthMode,
  { heading: string; toggleLabel: string; toggleTarget: AuthMode }
> = {
  "sign-in": {
    heading: "Welcome back",
    toggleLabel: "New here? Create an account",
    toggleTarget: "sign-up",
  },
  "sign-up": {
    heading: "Create your account",
    toggleLabel: "Already have an account? Sign in",
    toggleTarget: "sign-in",
  },
};

function AuthPageContent({ initialMode }: { initialMode: AuthMode }) {
  const { user, loading, isGuestMode, signInAsGuest } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams?.get("error");
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [view, setView] = useState<"password" | "magic-link" | "reset">(
    "password",
  );

  useEffect(() => {
    if (!loading && user && !isGuestMode) {
      router.push("/");
    }
  }, [user, loading, isGuestMode, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const handleGuestSignIn = () => {
    signInAsGuest();
    router.push("/");
  };

  const copy = MODE_COPY[mode];

  return (
    <div className="h-dvh w-full overflow-y-auto bg-background">
      <div className="min-h-full flex items-center justify-center px-2 py-4 sm:p-4">
        <motion.div {...slideUp} className="max-w-md w-full space-y-5">
          <div className="px-4 py-6 sm:p-8 rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-col items-center gap-5 sm:gap-6">
              <Image
                src="/kagelin-icon.png"
                alt="Kagelin"
                width={64}
                height={64}
                priority
                className="h-12 w-12 sm:h-16 sm:w-16 rounded-2xl shrink-0"
              />

              <div className="text-center space-y-1.5">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {copy.heading}
                </h1>
                <p className="text-[13px] font-medium text-muted-foreground/80 lowercase tracking-wide">
                  Work quietly. Own everything.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setView((v) => (v === "reset" ? "password" : v));
                    setMode(copy.toggleTarget);
                  }}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors pt-1"
                >
                  {copy.toggleLabel}
                </button>
              </div>

              {error && (
                <p className="text-sm text-destructive font-medium text-center bg-destructive/10 p-3 rounded-lg w-full">
                  {error.includes("Signups not allowed") ||
                  error.includes("signup_disabled")
                    ? "This app is private. Only authorized users can sign in."
                    : "Authentication failed. Please try again."}
                </p>
              )}

              {view === "reset" ? (
                <ResetPasswordAuth onBackToSignIn={() => setView("password")} />
              ) : view === "password" ? (
                <PasswordAuth
                  key={mode}
                  mode={mode}
                  onSwitchToSignIn={() => setMode("sign-in")}
                  onForgotPassword={() => setView("reset")}
                  onSwitchToMagicLink={() => setView("magic-link")}
                />
              ) : (
                <MagicLinkAuth
                  key={mode}
                  onSwitchToPassword={() => setView("password")}
                />
              )}

              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-muted-foreground font-medium">
                    Or continue with
                  </span>
                </div>
              </div>

              <OAuthProviderRow />

              <Button
                type="button"
                variant="outline"
                onClick={handleGuestSignIn}
                className="w-full h-11 text-base font-medium transition-all"
              >
                Continue as guest
              </Button>
            </div>
          </div>

          <div className="px-4">
            <p className="text-[11px] leading-relaxed text-muted-foreground text-center">
              By continuing, you agree to our{" "}
              <a
                href={TERMS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href={PRIVACY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Privacy Policy
              </a>
              . Guest data is stored locally and will be lost if cleared.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function AuthPage({ initialMode }: { initialMode: AuthMode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <AuthPageContent initialMode={initialMode} />
    </Suspense>
  );
}
