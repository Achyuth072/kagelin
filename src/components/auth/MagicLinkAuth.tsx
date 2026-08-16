"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Turnstile } from "@/components/auth/Turnstile";
import { AUTH_LINK_CLASS } from "@/components/auth/authLinkClass";
import { AuthEmailField } from "@/components/auth/AuthEmailField";
import { AuthConfirmationCard } from "@/components/auth/AuthConfirmationCard";
import { useTurnstileCaptcha } from "@/lib/hooks/useTurnstileCaptcha";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function MagicLinkAuth({
  onSwitchToPassword,
}: {
  onSwitchToPassword?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const {
    captchaToken,
    setCaptchaToken,
    turnstileRef,
    handleCaptchaExpire,
    resetCaptcha,
  } = useTurnstileCaptcha();
  const { signInWithMagicLink } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !captchaToken) return;

    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await signInWithMagicLink(
        email,
        captchaToken,
      );
      if (signInError) {
        setError(signInError.message || "Failed to send magic link");
      } else {
        setSent(true);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      resetCaptcha();
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <AnimatePresence mode="wait">
        {!sent ? (
          <motion.form
            key="login-form"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <AuthEmailField
              id="email"
              value={email}
              onChange={setEmail}
              disabled={loading}
            >
              {onSwitchToPassword && (
                <button
                  type="button"
                  onClick={onSwitchToPassword}
                  className={AUTH_LINK_CLASS}
                >
                  Use a password instead
                </button>
              )}
            </AuthEmailField>

            {TURNSTILE_SITE_KEY && (
              <Turnstile
                siteKey={TURNSTILE_SITE_KEY}
                onVerify={setCaptchaToken}
                onExpire={handleCaptchaExpire}
                handleRef={turnstileRef}
              />
            )}

            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base font-medium transition-all"
              disabled={
                loading || !email || (!!TURNSTILE_SITE_KEY && !captchaToken)
              }
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Continuing...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </motion.form>
        ) : (
          <AuthConfirmationCard
            motionKey="success-message"
            title="Check your email"
            descriptionMaxWidthClassName="max-w-[240px]"
            description={
              <>
                We&apos;ve sent a magic link to{" "}
                <span className="font-medium text-foreground">{email}</span>.
                Click it to sign in.
              </>
            }
            actionLabel="Didn't get the email? Try again"
            onAction={() => setSent(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
