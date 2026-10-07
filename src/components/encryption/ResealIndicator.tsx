"use client";

import { useEffect, useEffectEvent, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import type { ResealProgress } from "@/lib/crypto/reseal";
import {
  resealUntilClean,
  UnreadableContentError,
} from "@/lib/crypto/resealUntilClean";

function failureMessage(error: unknown): string {
  if (!(error instanceof UnreadableContentError)) {
    return "Couldn't finish upgrading your encryption.";
  }
  const count = error.values.length;
  const places = [
    ...new Set(error.values.map((v) => `${v.table}.${v.column}`)),
  ].join(", ");
  return `${count} ${count === 1 ? "item" : "items"} can't be read (${places}), so your old key is kept.`;
}

// Non-blocking: the app stays usable while existing content is upgraded to row-bound sealing.
export function ResealIndicator({
  userId,
  onComplete,
}: {
  userId: string;
  onComplete: () => void;
}) {
  const [progress, setProgress] = useState<ResealProgress | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // A new callback identity must not restart a running Re-seal.
  const complete = useEffectEvent(onComplete);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    // Rows already in flight still report after an abort.
    const report = (p: ResealProgress) => {
      if (!signal.aborted) setProgress(p);
    };

    resealUntilClean(userId, report, signal)
      .then(() => {
        if (!signal.aborted) complete();
      })
      .catch((err) => {
        if (signal.aborted) return;
        Sentry.captureException(err);
        setFailure(failureMessage(err));
      });

    return () => controller.abort();
  }, [userId, attempt]);

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-3 rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground shadow-md"
    >
      {failure ? (
        <>
          <span>{failure}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setFailure(null);
              setAttempt((n) => n + 1);
            }}
          >
            Retry
          </Button>
        </>
      ) : (
        <span>
          Upgrading encryption
          {progress && progress.total > 0
            ? ` — ${progress.done} of ${progress.total}`
            : "…"}
        </span>
      )}
    </div>
  );
}
