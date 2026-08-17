"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { slideUp } from "@/lib/motion";

// Shared chrome for standalone auth routes (sign-in/up, and one-off pages like
// /auth/email-confirmed) — logo + card container + background, kept in sync
// across both so neither drifts from the design system on its own.
export function AuthShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="h-dvh w-full overflow-y-auto bg-background">
      <div className="min-h-full flex items-center justify-center px-2 py-4 sm:p-4">
        <motion.div {...slideUp} className="max-w-md w-full space-y-5">
          <div className="px-4 py-6 sm:p-8 rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex flex-col items-center gap-5 sm:gap-6">
              <Image
                src="/kagelin-icon.png"
                alt="Kagelin"
                width={64}
                height={64}
                priority
                className="h-12 w-12 sm:h-16 sm:w-16 rounded-2xl shrink-0"
              />
              {children}
            </div>
          </div>
          {footer}
        </motion.div>
      </div>
    </div>
  );
}
