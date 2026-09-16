import { useState } from "react";
import { checkPassphraseStrength } from "@/lib/crypto/passphraseStrength";

export function useNewPassphraseForm() {
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");

  const { tooShort, weak } = checkPassphraseStrength(passphrase);
  const mismatch = confirmPassphrase !== passphrase;
  const showMismatch = confirmPassphrase.length > 0 && mismatch;

  const reset = () => {
    setPassphrase("");
    setConfirmPassphrase("");
  };

  return {
    passphrase,
    setPassphrase,
    confirmPassphrase,
    setConfirmPassphrase,
    tooShort,
    weak,
    mismatch,
    showMismatch,
    reset,
  };
}
