"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthConfirmationCard } from "@/components/auth/AuthConfirmationCard";
import { AuthShell } from "@/components/auth/AuthShell";
import { trackSignupCompleted } from "@/lib/telemetry/client";

export default function EmailConfirmedPage() {
  const router = useRouter();

  useEffect(() => {
    trackSignupCompleted();
  }, []);

  return (
    <AuthShell>
      <AuthConfirmationCard
        motionKey="email-confirmed"
        title="Email confirmed"
        description="Your account is ready. Sign in to continue."
        actionLabel="Sign in"
        onAction={() => router.push("/login")}
      />
    </AuthShell>
  );
}
