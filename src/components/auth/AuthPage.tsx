"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MagicLinkAuth } from "@/components/auth/MagicLinkAuth";
import { PasswordAuth } from "@/components/auth/PasswordAuth";
import { ResetPasswordAuth } from "@/components/auth/ResetPasswordAuth";
import { OAuthProviderRow } from "@/components/auth/OAuthProviderRow";
import { AuthShell } from "@/components/auth/AuthShell";
import { PrivacyPolicyLink } from "@/components/ui/privacy-policy-link";
import { TERMS_URL } from "@/lib/links";
import {
  SIGNUP_DISABLED_MESSAGE,
  isSignupDisabledError,
} from "@/lib/auth/format-auth-error";

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
    <AuthShell
      footer={
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
            and <PrivacyPolicyLink />. Guest data is stored locally and will be
            lost if cleared.
          </p>
        </div>
      }
    >
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
        <p
          role="alert"
          className="text-sm text-destructive font-medium text-center bg-destructive-surface p-3 rounded-lg w-full"
        >
          {isSignupDisabledError(error)
            ? SIGNUP_DISABLED_MESSAGE
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
    </AuthShell>
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
