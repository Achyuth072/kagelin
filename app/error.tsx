"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { slideUp } from "@/lib/motion";
import * as Sentry from "@sentry/nextjs";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Unhandled render error:", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div {...slideUp} className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
        </div>

        <h1 className="text-3xl font-semibold">Something went wrong</h1>

        <p className="text-muted-foreground max-w-md">
          Kagelin hit an unexpected error. Your data is safe — try again, or
          head back home if it keeps happening.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => router.push("/")}>
            Go home
          </Button>
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </motion.div>
    </div>
  );
}
