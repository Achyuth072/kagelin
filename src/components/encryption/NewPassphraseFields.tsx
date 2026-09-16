"use client";

import { AuthPasswordField } from "@/components/auth/AuthPasswordField";
import { PassphraseStrengthHints } from "@/components/encryption/PassphraseStrengthHints";

export function NewPassphraseFields({
  idPrefix,
  passphraseLabel,
  confirmLabel,
  labelClassName,
  passphrase,
  onPassphraseChange,
  confirmPassphrase,
  onConfirmPassphraseChange,
  tooShort,
  weak,
  showMismatch,
  disabled,
}: {
  idPrefix: string;
  passphraseLabel: string;
  confirmLabel: string;
  labelClassName?: string;
  passphrase: string;
  onPassphraseChange: (value: string) => void;
  confirmPassphrase: string;
  onConfirmPassphraseChange: (value: string) => void;
  tooShort: boolean;
  weak: boolean;
  showMismatch: boolean;
  disabled: boolean;
}) {
  return (
    <>
      <AuthPasswordField
        id={idPrefix}
        label={passphraseLabel}
        labelClassName={labelClassName}
        value={passphrase}
        onChange={onPassphraseChange}
        disabled={disabled}
        autoComplete="new-password"
      >
        <PassphraseStrengthHints
          passphrase={passphrase}
          tooShort={tooShort}
          weak={weak}
        />
      </AuthPasswordField>

      <AuthPasswordField
        id={`${idPrefix}-confirm`}
        label={confirmLabel}
        labelClassName={labelClassName}
        value={confirmPassphrase}
        onChange={onConfirmPassphraseChange}
        disabled={disabled}
        autoComplete="new-password"
      >
        {showMismatch && (
          <p className="text-xs text-destructive">
            Passphrases don&apos;t match.
          </p>
        )}
      </AuthPasswordField>
    </>
  );
}
