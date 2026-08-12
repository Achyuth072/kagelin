export type OAuthProviderId = "google" | "github" | "gitlab";

export type OAuthProviderConfig = {
  id: OAuthProviderId;
  label: string;
};

// Distinct from external-calendar.ts's OAUTH_PROVIDERS (calendar sync).
export const SIGNIN_OAUTH_PROVIDERS: readonly OAuthProviderConfig[] = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
  { id: "gitlab", label: "GitLab" },
];
