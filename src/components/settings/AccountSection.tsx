"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  SIGNIN_OAUTH_PROVIDERS,
  type OAuthProviderId,
} from "@/lib/auth/providers";
import { PROVIDER_ICONS } from "@/components/auth/ProviderIcons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  Link2,
  Unlink,
  KeyRound,
  AlertCircle,
  Mail,
} from "lucide-react";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { PasswordBreachWarning } from "@/components/auth/PasswordBreachWarning";
import { usePasswordBreachCheck } from "@/lib/hooks/usePasswordBreachCheck";
import {
  MIN_PASSWORD_LENGTH,
  isPasswordTooShort,
} from "@/lib/auth/password-policy";
import { formatLinkError } from "@/lib/auth/format-auth-error";
import { useHasPassword } from "@/lib/hooks/useHasPassword";
import { notify } from "@/lib/notify";
import { SUPPORT_EMAIL } from "@/lib/links";
import type { UserIdentity } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { ICON_LED_ROW_CLASS } from "@/components/settings/iconLedRowClass";
import { SETTINGS_CARD_CLASS } from "@/components/settings/settingsCardClass";

export function AccountSection() {
  const {
    user,
    linkIdentity,
    unlinkIdentity,
    updatePassword,
    reauthenticate,
    isGuestMode,
  } = useAuth();
  const searchParams = useSearchParams();
  const { hasPassword, refetchHasPassword } = useHasPassword();

  const [password, setPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  // Set once GoTrue rejects the change with "reauthentication_needed" (session
  // >24h old, Secure Password Change is on) — see AuthProvider.reauthenticate.
  const [reauthRequired, setReauthRequired] = useState(false);
  const [nonce, setNonce] = useState("");
  const [resendingCode, setResendingCode] = useState(false);

  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);

  const urlError =
    searchParams?.get("error") || searchParams?.get("error_description");
  const urlErrorCode = searchParams?.get("error_code");
  const connectingProviderId = searchParams?.get("connecting");
  const connectingLabel = SIGNIN_OAUTH_PROVIDERS.find(
    (p) => p.id === connectingProviderId,
  )?.label;
  const displayError =
    providerError ||
    (urlError
      ? formatLinkError(urlError, connectingLabel, urlErrorCode)
      : null);

  const identities = user?.identities ?? [];
  const totalIdentities =
    identities.length > 0 ? identities.length : user?.email ? 1 : 0;
  const isLastIdentity = totalIdentities <= 1;

  const emailIdentity = identities.find((entry) => entry.provider === "email");
  const passwordTooShort = isPasswordTooShort(password);
  const { breached, checkOnBlur, clearBreach } = usePasswordBreachCheck();

  const handleConnect = async (providerId: OAuthProviderId, label: string) => {
    setLoadingProvider(providerId);
    setProviderError(null);

    try {
      const { error } = await linkIdentity(providerId);
      if (error) {
        setProviderError(formatLinkError(error, label));
      }
    } catch (err) {
      setProviderError(formatLinkError(err as Error, label));
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleDisconnect = async (identity: UserIdentity, label: string) => {
    if (isLastIdentity) return;

    setLoadingProvider(identity.provider);
    setProviderError(null);

    try {
      const { error } = await unlinkIdentity(identity);
      if (error) {
        setProviderError(error.message || "Failed to disconnect provider");
        notify.error("Failed to disconnect provider");
      } else {
        notify.success(`Disconnected ${label}`);
      }
    } catch (err) {
      setProviderError(
        (err as Error).message || "An unexpected error occurred",
      );
      notify.error("Failed to disconnect provider");
    } finally {
      setLoadingProvider(null);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || passwordTooShort) return;
    const trimmedNonce = nonce.trim();
    if (reauthRequired && !trimmedNonce) return;

    setPasswordSubmitting(true);
    setPasswordError(null);

    try {
      const { error } = await updatePassword(
        password,
        reauthRequired ? trimmedNonce : undefined,
      );
      if (!error) {
        notify.success(
          hasPassword
            ? "Password changed successfully"
            : "Password set successfully",
        );
        setPassword("");
        setNonce("");
        setReauthRequired(false);
        refetchHasPassword();
      } else if (error.code === "reauthentication_needed") {
        setReauthRequired(true);
        const { error: sendError } = await reauthenticate();
        if (sendError) {
          setPasswordError(
            sendError.message || "Failed to send verification code",
          );
        }
      } else if (
        error.code === "reauthentication_not_valid" ||
        error.code === "reauth_nonce_missing"
      ) {
        setPasswordError(
          "That code wasn't right. Check your email and try again.",
        );
      } else {
        setPasswordError(error.message || "Failed to update password");
      }
    } catch {
      setPasswordError("An unexpected error occurred");
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setPasswordError(null);
    setResendingCode(true);
    try {
      const { error } = await reauthenticate();
      if (error) {
        setPasswordError(error.message || "Failed to send verification code");
      } else {
        notify.success("Verification code resent");
      }
    } catch {
      setPasswordError("Failed to send verification code");
    } finally {
      setResendingCode(false);
    }
  };

  if (isGuestMode) {
    return null;
  }

  return (
    <div className="space-y-6">
      {displayError && (
        <div
          role="alert"
          className="flex items-center gap-2 p-3.5 rounded-lg border border-destructive-surface-border bg-destructive-surface text-destructive text-sm font-medium"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{displayError}</span>
        </div>
      )}

      <Card className={SETTINGS_CARD_CLASS}>
        <CardHeader className="pb-3 px-4 pt-5">
          <CardTitle className="flex items-center gap-2 text-base font-medium tracking-tight">
            <Link2 className="h-4 w-4 text-brand" strokeWidth={2.25} />
            Connected Providers
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground/80 lowercase">
            Manage the providers connected to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          {emailIdentity && (
            // The `email` Provider backs both password and magic-link sign-in;
            // this row is about the Provider connection, not whether a
            // password is set — that's the card below.
            <div className={cn(ICON_LED_ROW_CLASS, "justify-between")}>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-foreground/70" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-xs text-muted-foreground">Connected</p>
                </div>
              </div>
            </div>
          )}

          {SIGNIN_OAUTH_PROVIDERS.map((provider) => {
            const Icon = PROVIDER_ICONS[provider.id];
            const identity = identities.find(
              (entry) => entry.provider === provider.id,
            );
            const isConnected = !!identity;

            return (
              <div
                key={provider.id}
                className={cn(ICON_LED_ROW_CLASS, "justify-between")}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-foreground/70" />
                  <div>
                    <p className="text-sm font-medium">{provider.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {isConnected ? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>

                {isConnected ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isLastIdentity || loadingProvider === provider.id}
                    onClick={() =>
                      identity && handleDisconnect(identity, provider.label)
                    }
                    aria-label={`Disconnect ${provider.label}`}
                    className={cn(
                      "h-11 sm:h-8 gap-1.5 text-xs font-medium border-border/50",
                      isLastIdentity && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    {loadingProvider === provider.id ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Disconnecting...
                      </>
                    ) : (
                      <>
                        <Unlink className="h-3.5 w-3.5" />
                        Disconnect
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingProvider === provider.id}
                    onClick={() => handleConnect(provider.id, provider.label)}
                    aria-label={`Connect ${provider.label}`}
                    className="h-11 sm:h-8 gap-1.5 text-xs font-medium border-border/50 hover:bg-secondary/40"
                  >
                    {loadingProvider === provider.id ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Link2 className="h-3.5 w-3.5 text-brand" />
                        Connect
                      </>
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className={SETTINGS_CARD_CLASS}>
        <CardHeader className="pb-3 px-4 pt-5">
          <CardTitle className="flex items-center gap-2 text-base font-medium tracking-tight">
            <KeyRound className="h-4 w-4 text-brand" strokeWidth={2.25} />
            {hasPassword ? "Change Password" : "Set Password"}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground/80 lowercase">
            {hasPassword
              ? "Update your existing account password."
              : "Set a password to enable email and password sign-in for your account."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-5 pt-0">
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <AuthPasswordField
              id="account-password-input"
              label="New Password"
              labelClassName="text-[11px] uppercase tracking-wider text-muted-foreground/60"
              inputClassName="h-11 sm:h-10 bg-background/30 border-border/40 focus:border-brand/50 focus:ring-0 transition-all text-base sm:text-sm"
              value={password}
              onChange={(value) => {
                setPassword(value);
                clearBreach();
              }}
              onBlur={() => checkOnBlur(password, passwordTooShort)}
              disabled={passwordSubmitting}
              minLength={MIN_PASSWORD_LENGTH}
            >
              {passwordTooShort && (
                <p className="text-xs text-muted-foreground">
                  Password must be at least {MIN_PASSWORD_LENGTH} characters.
                </p>
              )}
              <PasswordBreachWarning breached={breached} />
            </AuthPasswordField>

            {reauthRequired && (
              <div className="space-y-2">
                <Label
                  htmlFor="account-password-nonce"
                  className="text-[11px] uppercase tracking-wider text-muted-foreground/60"
                >
                  Verification code
                </Label>
                <Input
                  id="account-password-nonce"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={nonce}
                  onChange={(e) => setNonce(e.target.value)}
                  disabled={passwordSubmitting}
                  placeholder="Enter the code from your email"
                  className="h-11 sm:h-10 bg-background/30 border-border/40 focus-visible:border-brand/50 text-base sm:text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  For your security, we sent a code to your email to confirm
                  this change.{" "}
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendingCode}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {resendingCode ? "Resending…" : "Resend code"}
                  </button>
                  {" · "}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Contact support
                  </a>
                </p>
              </div>
            )}

            {passwordError && (
              <p role="alert" className="text-xs text-destructive font-medium">
                {passwordError}
              </p>
            )}

            <Button
              type="submit"
              disabled={
                passwordSubmitting ||
                !password ||
                passwordTooShort ||
                (reauthRequired && !nonce.trim())
              }
              className="h-11 sm:h-9 px-4 text-xs font-semibold bg-brand hover:bg-brand/90 text-brand-foreground transition-all"
            >
              {passwordSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {reauthRequired
                    ? "Confirming..."
                    : hasPassword
                      ? "Updating..."
                      : "Setting..."}
                </>
              ) : reauthRequired ? (
                "Confirm password change"
              ) : hasPassword ? (
                "Change password"
              ) : (
                "Set password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
