"use client";

import { useEffect, useEffectEvent, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { notify } from "@/lib/notify";
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

const TOAST_ID = "reseal";

function progressMessage(progress: ResealProgress | null): string {
  return progress && progress.total > 0
    ? `Upgrading encryption — ${progress.done} of ${progress.total}`
    : "Upgrading encryption…";
}

// Non-blocking: the app stays usable while existing content is upgraded to row-bound sealing.
export function ResealIndicator({
  userId,
  onComplete,
}: {
  userId: string;
  onComplete: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  // A new callback identity must not restart a running Re-seal.
  const complete = useEffectEvent(onComplete);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    // Rows already in flight still report after an abort.
    const report = (p: ResealProgress | null) => {
      if (!signal.aborted) {
        notify.loading(progressMessage(p), {
          id: TOAST_ID,
          dismissible: false,
        });
      }
    };

    report(null);
    resealUntilClean(userId, report, signal)
      .then(() => {
        if (signal.aborted) return;
        notify.dismiss(TOAST_ID);
        complete();
      })
      .catch((err) => {
        if (signal.aborted) return;
        Sentry.captureException(err);
        notify(failureMessage(err), {
          id: TOAST_ID,
          duration: Infinity,
          action: { label: "Retry", onClick: () => setAttempt((n) => n + 1) },
        });
      });

    return () => {
      controller.abort();
      notify.dismiss(TOAST_ID);
    };
  }, [userId, attempt]);

  return null;
}
