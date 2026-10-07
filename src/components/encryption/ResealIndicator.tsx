"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  findPendingRows,
  runBackfillMigration,
  type MigrationProgress,
} from "@/lib/crypto/backfillMigration";
import { markResealComplete } from "@/lib/crypto/keyManager";

// A concurrent edit on another device fails one pass; the next pass picks it up.
const MAX_PASSES = 3;

async function resealUntilClean(
  userId: string,
  onProgress: (progress: MigrationProgress) => void,
): Promise<void> {
  let lastError: unknown;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    try {
      await runBackfillMigration(userId, onProgress);
    } catch (err) {
      lastError = err;
      continue;
    }
    if ((await findPendingRows(userId)).length === 0) {
      await markResealComplete(userId);
      return;
    }
  }
  throw lastError ?? new Error("Some content still needs upgrading.");
}

// Non-blocking: the app stays usable while existing content is upgraded to row-bound sealing.
export function ResealIndicator({
  userId,
  onComplete,
}: {
  userId: string;
  onComplete: () => void;
}) {
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const running = useRef(false);

  useEffect(() => {
    if (running.current) return;
    running.current = true;

    resealUntilClean(userId, setProgress)
      .then(onComplete)
      .catch(() => setFailed(true))
      .finally(() => {
        running.current = false;
      });
  }, [userId, onComplete, attempt]);

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-3 rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground shadow-md"
    >
      {failed ? (
        <>
          <span>Couldn&apos;t finish upgrading your encryption.</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setFailed(false);
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
