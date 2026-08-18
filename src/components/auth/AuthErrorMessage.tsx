"use client";

export function AuthErrorMessage({ error }: { error: string | null }) {
  if (!error) return null;

  return (
    <p role="alert" className="text-sm text-destructive font-medium">
      {error}
    </p>
  );
}
