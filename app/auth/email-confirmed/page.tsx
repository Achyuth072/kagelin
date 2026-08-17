"use client";

import { useRouter } from "next/navigation";
import { AuthConfirmationCard } from "@/components/auth/AuthConfirmationCard";

export default function EmailConfirmedPage() {
  const router = useRouter();

  return (
    <div className="h-dvh w-full flex items-center justify-center px-4 bg-background">
      <div className="max-w-md w-full">
        <AuthConfirmationCard
          motionKey="email-confirmed"
          title="Email confirmed"
          description="Your account is ready. Sign in to continue."
          actionLabel="Sign in"
          onAction={() => router.push("/login")}
        />
      </div>
    </div>
  );
}
