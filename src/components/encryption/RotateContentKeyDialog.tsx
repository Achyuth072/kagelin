"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { NewPassphraseFields } from "@/components/encryption/NewPassphraseFields";
import { RecoveryCodeDisplay } from "@/components/encryption/RecoveryCodeDisplay";
import { useNewPassphraseForm } from "@/lib/hooks/useNewPassphraseForm";
import {
  rotateContentKey,
  type RotateContentKeyResult,
} from "@/lib/crypto/keyManager";

export function RotateContentKeyDialog({
  userId,
  open,
  onOpenChange,
  onCommitted,
}: {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Fires once the rotation is committed, so the caller can start the Re-seal.
  onCommitted: () => void;
}) {
  const [step, setStep] = useState<"explain" | "passphrase" | "done">(
    "explain",
  );
  const [result, setResult] = useState<RotateContentKeyResult | null>(null);
  const [currentPassphrase, setCurrentPassphrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    passphrase,
    setPassphrase,
    confirmPassphrase,
    setConfirmPassphrase,
    tooShort,
    weak,
    mismatch,
    showMismatch,
    reset,
  } = useNewPassphraseForm();

  const close = () => {
    onOpenChange(false);
    setStep("explain");
    setResult(null);
    setError(null);
    setCurrentPassphrase("");
    reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassphrase || !passphrase || tooShort || mismatch) return;

    setSubmitting(true);
    setError(null);
    try {
      setResult(await rotateContentKey(userId, currentPassphrase, passphrase));
      setStep("done");
      onCommitted();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't rotate your key.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      // The recovery code is shown once; closing is only allowed through "Done".
      onOpenChange={(next) => {
        if (step === "done") return;
        if (next) onOpenChange(true);
        else close();
      }}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Rotate content key</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {step === "explain" &&
              "Use this if you think your key leaked. It replaces the key that protects your content."}
            {step === "passphrase" &&
              "Choose a new passphrase. Your old passphrase and recovery code will stop working."}
            {step === "done" &&
              "Your key is rotated. Save this new recovery code — it's shown only once."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="px-4 pb-4 sm:p-0">
          {step === "explain" && (
            <div className="space-y-4 text-sm text-muted-foreground">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Every other device is signed out.</li>
                <li>Changes not yet synced from those devices are lost.</li>
                <li>
                  Your content is re-encrypted in the background. You can keep
                  using Kagelin meanwhile.
                </li>
                <li>
                  Backups made before today keep copies sealed with the old key
                  for up to 30 days.
                </li>
              </ul>
              <Button
                type="button"
                className="h-11 sm:h-9 px-4 text-xs font-semibold"
                onClick={() => setStep("passphrase")}
              >
                Continue
              </Button>
            </div>
          )}

          {step === "passphrase" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <AuthPasswordField
                id="rotate-current-passphrase"
                label="Current Passphrase"
                value={currentPassphrase}
                onChange={setCurrentPassphrase}
                disabled={submitting}
                autoComplete="current-password"
              />
              <NewPassphraseFields
                idPrefix="rotate-passphrase"
                passphraseLabel="New Passphrase"
                confirmLabel="Confirm New Passphrase"
                passphrase={passphrase}
                onPassphraseChange={setPassphrase}
                confirmPassphrase={confirmPassphrase}
                onConfirmPassphraseChange={setConfirmPassphrase}
                tooShort={tooShort}
                weak={weak}
                showMismatch={showMismatch}
                disabled={submitting}
              />
              {error && (
                <p
                  role="alert"
                  className="text-xs text-destructive font-medium"
                >
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={
                  submitting ||
                  !currentPassphrase ||
                  !passphrase ||
                  tooShort ||
                  mismatch
                }
                className="h-11 sm:h-9 px-4 text-xs font-semibold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Rotating...
                  </>
                ) : (
                  "Rotate key"
                )}
              </Button>
            </form>
          )}

          {step === "done" && result && (
            <div className="space-y-4">
              {!result.otherSessionsSignedOut && (
                <p
                  role="alert"
                  className="text-xs text-destructive font-medium"
                >
                  We couldn&apos;t sign out your other devices. Sign out of them
                  yourself.
                </p>
              )}
              <RecoveryCodeDisplay
                recoveryCode={result.recoveryCode}
                onContinue={close}
                continueLabel="Done"
              />
            </div>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
