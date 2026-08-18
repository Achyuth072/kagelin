"use client";

import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { SIGNIN_OAUTH_PROVIDERS } from "@/lib/auth/providers";
import { PROVIDER_ICONS } from "@/components/auth/ProviderIcons";

export function OAuthProviderRow() {
  const { signInWithOAuth } = useAuth();

  return (
    <div className="grid grid-cols-3 gap-3 w-full">
      {SIGNIN_OAUTH_PROVIDERS.map((provider) => {
        const Icon = PROVIDER_ICONS[provider.id];
        return (
          <Button
            key={provider.id}
            type="button"
            variant="outline"
            aria-label={provider.label}
            title={provider.label}
            onClick={() => signInWithOAuth(provider.id)}
            className="flex items-center justify-center h-11 bg-background/50 border-border hover:bg-accent transition-all duration-200"
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}
