import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NewPassphraseStep } from "@/components/encryption/NewPassphraseStep";
import { setPassphraseAfterRecovery } from "@/lib/crypto/keyManager";

vi.mock("@/lib/crypto/keyManager", () => ({
  setPassphraseAfterRecovery: vi.fn(),
}));

function fillPassphrase(passphrase: string, confirm = passphrase) {
  fireEvent.change(screen.getByLabelText("New passphrase"), {
    target: { value: passphrase },
  });
  fireEvent.change(screen.getByLabelText("Confirm new passphrase"), {
    target: { value: confirm },
  });
}

describe("NewPassphraseStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disables submit until the passphrase clears the minimum length", () => {
    render(<NewPassphraseStep userId="user-1" onDone={vi.fn()} />);
    const submit = screen.getByRole("button", { name: "Set passphrase" });

    fillPassphrase("short");
    expect(submit).toBeDisabled();

    fillPassphrase("a sufficiently long passphrase");
    expect(submit).not.toBeDisabled();
  });

  it("disables submit and shows an error when the confirmation doesn't match", () => {
    render(<NewPassphraseStep userId="user-1" onDone={vi.fn()} />);
    fillPassphrase("a sufficiently long passphrase", "something else entirely");

    expect(screen.getByText("Passphrases don't match.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Set passphrase" }),
    ).toBeDisabled();
  });

  it("calls setPassphraseAfterRecovery and onDone on success, without asking for the old passphrase", async () => {
    vi.mocked(setPassphraseAfterRecovery).mockResolvedValue(undefined);
    const onDone = vi.fn();
    render(<NewPassphraseStep userId="user-1" onDone={onDone} />);

    expect(screen.queryByLabelText(/current/i)).not.toBeInTheDocument();

    fillPassphrase("a sufficiently long passphrase");
    fireEvent.click(screen.getByRole("button", { name: "Set passphrase" }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(setPassphraseAfterRecovery).toHaveBeenCalledWith(
      "user-1",
      "a sufficiently long passphrase",
    );
  });

  it("shows an error and doesn't call onDone if setting the passphrase fails", async () => {
    vi.mocked(setPassphraseAfterRecovery).mockRejectedValue(
      new Error("network down"),
    );
    const onDone = vi.fn();
    render(<NewPassphraseStep userId="user-1" onDone={onDone} />);

    fillPassphrase("a sufficiently long passphrase");
    fireEvent.click(screen.getByRole("button", { name: "Set passphrase" }));

    await waitFor(() =>
      expect(screen.getByText("network down")).toBeInTheDocument(),
    );
    expect(onDone).not.toHaveBeenCalled();
  });
});
