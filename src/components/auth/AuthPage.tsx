"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MagicLinkAuth } from "@/components/auth/MagicLinkAuth";
import { PasswordAuth } from "@/components/auth/PasswordAuth";
import { OAuthProviderRow } from "@/components/auth/OAuthProviderRow";
import { slideUp } from "@/lib/motion";

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
  const [emailMethod, setEmailMethod] = useState<"password" | "magic-link">(
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
        <motion.div {...slideUp} className="max-w-md w-full space-y-6">
          <div className="px-4 py-8 sm:p-8 rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-col items-center gap-8">
              <Image
                src="/kagelin-icon.png"
                alt="Kagelin"
                width={64}
                height={64}
                priority
                className="h-16 w-16 rounded-2xl shrink-0"
              />

              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">
                  {copy.heading}
                </h1>
                <p className="text-[13px] font-medium text-muted-foreground/80 lowercase tracking-wide">
                  Work quietly. Own everything.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMode(copy.toggleTarget)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors -mt-4"
              >
                {copy.toggleLabel}
              </button>

              {error && (
                <p className="text-sm text-destructive font-medium text-center bg-destructive/10 p-3 rounded-lg w-full">
                  {error.includes("Signups not allowed") ||
                  error.includes("signup_disabled")
                    ? "This app is private. Only authorized users can sign in."
                    : "Authentication failed. Please try again."}
                </p>
              )}

              {emailMethod === "password" ? (
                <PasswordAuth
                  key={mode}
                  mode={mode}
                  onSwitchToSignIn={() => setMode("sign-in")}
                />
              ) : (
                <MagicLinkAuth key={mode} />
              )}

              <button
                type="button"
                onClick={() =>
                  setEmailMethod(
                    emailMethod === "password" ? "magic-link" : "password",
                  )
                }
                className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
              >
                {emailMethod === "password"
                  ? "Email me a link instead"
                  : "Use a password instead"}
              </button>

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
            </div>
          </div>

          <div className="space-y-3 text-center px-4">
            <Button
              type="button"
              variant="link"
              onClick={handleGuestSignIn}
              className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
            >
              Continue as guest
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              By continuing, you agree to our{" "}
              <a
                href="https://www.kagelin.app/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="https://www.kagelin.app/privacy"
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
