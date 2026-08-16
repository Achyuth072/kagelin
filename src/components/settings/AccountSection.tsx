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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Lock,
  Loader2,
  Link2,
  Unlink,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import { PasswordBreachWarning } from "@/components/auth/PasswordBreachWarning";
import { usePasswordBreachCheck } from "@/lib/hooks/usePasswordBreachCheck";
import {
  MIN_PASSWORD_LENGTH,
  isPasswordTooShort,
} from "@/lib/auth/password-policy";
import { formatLinkError } from "@/lib/auth/format-auth-error";
import { notify } from "@/lib/notify";
import type { UserIdentity } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { ICON_LED_ROW_CLASS } from "@/components/settings/iconLedRowClass";

const SETTINGS_CARD_CLASS = "border-border/50 shadow-none bg-background/50";

export function AccountSection() {
  const { user, linkIdentity, unlinkIdentity, updatePassword, isGuestMode } =
    useAuth();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);

  const urlError =
    searchParams?.get("error") || searchParams?.get("error_description");
  const connectingProviderId = searchParams?.get("connecting");
  const connectingLabel = SIGNIN_OAUTH_PROVIDERS.find(
    (p) => p.id === connectingProviderId,
  )?.label;
  const displayError =
    providerError ||
    (urlError ? formatLinkError(urlError, connectingLabel) : null);

  const identities = user?.identities ?? [];
  const totalIdentities =
    identities.length > 0 ? identities.length : user?.email ? 1 : 0;
  const isLastIdentity = totalIdentities <= 1;

  const hasPassword = identities.some((id) => id.provider === "email");
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

    setPasswordSubmitting(true);
    setPasswordError(null);

    try {
      const { error } = await updatePassword(password);
      if (error) {
        setPasswordError(error.message || "Failed to update password");
      } else {
        notify.success(
          hasPassword
            ? "Password changed successfully"
            : "Password set successfully",
        );
        setPassword("");
      }
    } catch {
      setPasswordError("An unexpected error occurred");
    } finally {
      setPasswordSubmitting(false);
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
          className="flex items-center gap-2 p-3.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm font-medium"
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
          {SIGNIN_OAUTH_PROVIDERS.map((provider) => {
            const Icon = PROVIDER_ICONS[provider.id];
            const identity = identities.find(
              (id) => id.provider === provider.id,
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
            <div className="space-y-1.5">
              <label
                htmlFor="account-password-input"
                className="text-[11px] uppercase tracking-wider text-muted-foreground/60"
              >
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="account-password-input"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9 h-11 sm:h-10 bg-background/30 border-border/40 focus:border-brand/50 focus:ring-0 transition-all text-base sm:text-sm"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearBreach();
                  }}
                  onBlur={() => checkOnBlur(password, passwordTooShort)}
                  disabled={passwordSubmitting}
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

            {passwordError && (
              <p role="alert" className="text-xs text-destructive font-medium">
                {passwordError}
              </p>
            )}

            <Button
              type="submit"
              disabled={passwordSubmitting || !password || passwordTooShort}
              className="h-11 sm:h-9 px-4 text-xs font-semibold bg-brand hover:bg-brand/90 text-brand-foreground transition-all"
            >
              {passwordSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {hasPassword ? "Updating..." : "Setting..."}
                </>
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
