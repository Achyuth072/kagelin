"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Turnstile } from "@/components/auth/Turnstile";
import { AuthEmailField } from "@/components/auth/AuthEmailField";
import { AuthConfirmationCard } from "@/components/auth/AuthConfirmationCard";
import { useTurnstileCaptcha } from "@/lib/hooks/useTurnstileCaptcha";
import { Loader2 } from "lucide-react";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Same confirmation copy whether or not the email is registered — Supabase's
// own resetPasswordForEmail gives no signal to distinguish the two, and
// branching on it here would just reintroduce the enumeration leak.
export function ResetPasswordAuth({
  onBackToSignIn,
}: {
  onBackToSignIn: () => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);
  const {
    captchaToken,
    setCaptchaToken,
    turnstileRef,
    handleCaptchaExpire,
    resetCaptcha,
  } = useTurnstileCaptcha();
  const { resetPasswordForEmail } = useAuth();

  const captchaMissing = !!TURNSTILE_SITE_KEY && !captchaToken;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || captchaMissing) return;

    setLoading(true);
    try {
      await resetPasswordForEmail(email, captchaToken ?? "");
    } finally {
      resetCaptcha();
      setLoading(false);
      setRequested(true);
    }
  };

  if (requested) {
    return (
      <AuthConfirmationCard
        motionKey="reset-requested"
        title="Check your inbox"
        description={
          <>
            {"If "}
            <span className="font-medium text-foreground">{email}</span>
            {" has an account, we've sent a link to reset the password."}
          </>
        }
        actionLabel="Back to sign in"
        onAction={onBackToSignIn}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <AuthEmailField
        id="reset-password-email"
        value={email}
        onChange={setEmail}
        disabled={loading}
      />

      {TURNSTILE_SITE_KEY && (
        <Turnstile
          siteKey={TURNSTILE_SITE_KEY}
          onVerify={setCaptchaToken}
          onExpire={handleCaptchaExpire}
          handleRef={turnstileRef}
        />
      )}

      <Button
        type="submit"
        className="w-full h-11 text-base font-medium transition-all"
        disabled={loading || !email || captchaMissing}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          "Send reset link"
        )}
      </Button>

      <button
        type="button"
        onClick={onBackToSignIn}
        className="w-full text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
      >
        Back to sign in
      </button>
    </form>
  );
}
