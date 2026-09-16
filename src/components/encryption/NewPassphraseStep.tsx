"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { NewPassphraseFields } from "@/components/encryption/NewPassphraseFields";
import { useNewPassphraseForm } from "@/lib/hooks/useNewPassphraseForm";
import { setPassphraseAfterRecovery } from "@/lib/crypto/keyManager";

export function NewPassphraseStep({
  userId,
  onDone,
}: {
  userId: string;
  onDone: () => void;
}) {
  const {
    passphrase,
    setPassphrase,
    confirmPassphrase,
    setConfirmPassphrase,
    tooShort,
    weak,
    mismatch,
    showMismatch,
  } = useNewPassphraseForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase || tooShort || mismatch) return;

    setSubmitting(true);
    setError(null);
    try {
      await setPassphraseAfterRecovery(userId, passphrase);
      onDone();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't set a new passphrase.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="w-full space-y-5">
        <div className="text-center space-y-1.5">
          <Lock className="h-8 w-8 mx-auto text-brand" strokeWidth={1.75} />
          <h1 className="text-xl font-bold tracking-tight">
            Set a new passphrase
          </h1>
          <p className="text-sm text-muted-foreground">
            Your old passphrase no longer works on this device. Choose a new one
            to finish recovering access.
          </p>
        </div>

        <NewPassphraseFields
          idPrefix="new-passphrase"
          passphraseLabel="New passphrase"
          confirmLabel="Confirm new passphrase"
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
          <p role="alert" className="text-sm text-destructive font-medium">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full h-11 text-base font-medium"
          disabled={submitting || !passphrase || tooShort || mismatch}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Setting passphrase...
            </>
          ) : (
            "Set passphrase"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
