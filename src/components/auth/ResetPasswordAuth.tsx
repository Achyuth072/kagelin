"use client";

import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { Turnstile, type TurnstileHandle } from "@/components/auth/Turnstile";

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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const { resetPasswordForEmail } = useAuth();
  const handleCaptchaExpire = useCallback(() => setCaptchaToken(null), []);

  const captchaMissing = !!TURNSTILE_SITE_KEY && !captchaToken;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || captchaMissing) return;

    setLoading(true);
    try {
      await resetPasswordForEmail(email, captchaToken ?? "");
    } finally {
      // Turnstile tokens are single-use. The confirmation always shows,
      // regardless of what resetPasswordForEmail returned or threw.
      setCaptchaToken(null);
      turnstileRef.current?.reset();
      setLoading(false);
      setRequested(true);
    }
  };

  if (requested) {
    return (
      <motion.div
        key="reset-requested"
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
            If <span className="font-medium text-foreground">{email}</span> has
            an account, we&apos;ve sent a link to reset the password.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBackToSignIn}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Back to sign in
        </Button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="reset-password-email"
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
            id="reset-password-email"
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
