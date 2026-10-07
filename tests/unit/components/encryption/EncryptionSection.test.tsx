import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EncryptionSection } from "@/components/settings/EncryptionSection";
import { useAuth } from "@/components/AuthProvider";
import { useEncryptionGateActions } from "@/components/encryption/EncryptionGate";
import {
  changePassphrase,
  reissueRecoveryCode,
  rotateContentKey,
} from "@/lib/crypto/keyManager";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/components/encryption/EncryptionGate", () => ({
  useEncryptionGateActions: vi.fn(),
}));

vi.mock("@/lib/crypto/keyManager", () => ({
  changePassphrase: vi.fn(),
  reissueRecoveryCode: vi.fn(),
  rotateContentKey: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

describe("EncryptionSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1" },
      isGuestMode: false,
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useEncryptionGateActions).mockReturnValue({
      lock: vi.fn().mockResolvedValue(undefined),
      beginReseal: vi.fn(),
    });
  });

  it("renders nothing for a guest", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "guest" },
      isGuestMode: true,
    } as unknown as ReturnType<typeof useAuth>);
    const { container } = render(<EncryptionSection />);
    expect(container).toBeEmptyDOMElement();
  });

  it("changes the passphrase and clears the form on success", async () => {
    vi.mocked(changePassphrase).mockResolvedValue(undefined);
    render(<EncryptionSection />);

    fireEvent.change(screen.getByLabelText("Current Passphrase"), {
      target: { value: "old passphrase" },
    });
    fireEvent.change(screen.getByLabelText("New Passphrase"), {
      target: { value: "a sufficiently long new passphrase" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Passphrase"), {
      target: { value: "a sufficiently long new passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change passphrase" }));

    await waitFor(() =>
      expect(changePassphrase).toHaveBeenCalledWith(
        "user-1",
        "old passphrase",
        "a sufficiently long new passphrase",
      ),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Current Passphrase")).toHaveValue(""),
    );
  });

  it("will not change the passphrase with the confirmation left blank", () => {
    render(<EncryptionSection />);

    fireEvent.change(screen.getByLabelText("Current Passphrase"), {
      target: { value: "old passphrase" },
    });
    fireEvent.change(screen.getByLabelText("New Passphrase"), {
      target: { value: "a sufficiently long new passphrase" },
    });

    const submit = screen.getByRole("button", { name: "Change passphrase" });
    expect(submit).toBeDisabled();

    fireEvent.submit(submit.closest("form")!);
    expect(changePassphrase).not.toHaveBeenCalled();
  });

  it("generates a new recovery code and shows it, requiring confirmation before it can be dismissed", async () => {
    vi.mocked(reissueRecoveryCode).mockResolvedValue(
      "NEWC-ODEA-BCDE-FGHJ-KMNP-QRST-VWXY-ZABC",
    );
    render(<EncryptionSection />);

    fireEvent.click(
      screen.getByRole("button", { name: "Generate new recovery code" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("NEWC-ODEA-BCDE-FGHJ-KMNP-QRST-VWXY-ZABC"),
      ).toBeInTheDocument(),
    );

    const doneButton = screen.getByRole("button", { name: "Done" });
    expect(doneButton).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(doneButton).not.toBeDisabled();
  });

  it("calls the gate's lock action when Lock Now is clicked", async () => {
    const lock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useEncryptionGateActions).mockReturnValue({
      lock,
      beginReseal: vi.fn(),
    });
    render(<EncryptionSection />);

    fireEvent.click(screen.getByRole("button", { name: "Lock now" }));

    await waitFor(() => expect(lock).toHaveBeenCalledTimes(1));
  });

  it("shows an error and re-enables the button if locking fails", async () => {
    const lock = vi.fn().mockRejectedValue(new Error("IndexedDB blocked"));
    vi.mocked(useEncryptionGateActions).mockReturnValue({
      lock,
      beginReseal: vi.fn(),
    });
    render(<EncryptionSection />);

    fireEvent.click(screen.getByRole("button", { name: "Lock now" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Lock now" }),
      ).not.toBeDisabled(),
    );
  });

  describe("rotating the content key", () => {
    const NEW_PASSPHRASE = "a sufficiently long rotated passphrase";
    const beginReseal = vi.fn();

    beforeEach(() => {
      vi.mocked(useEncryptionGateActions).mockReturnValue({
        lock: vi.fn(),
        beginReseal,
      });
    });

    async function reachPassphraseStep() {
      render(<EncryptionSection />);
      fireEvent.click(
        screen.getByRole("button", { name: "Rotate content key" }),
      );
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent(/signed out/);
      expect(dialog).toHaveTextContent(/30 days/);
      fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
      fireEvent.change(within(dialog).getByLabelText("Current Passphrase"), {
        target: { value: "the current passphrase" },
      });
      fireEvent.change(within(dialog).getByLabelText("New Passphrase"), {
        target: { value: NEW_PASSPHRASE },
      });
      fireEvent.change(
        within(dialog).getByLabelText("Confirm New Passphrase"),
        { target: { value: NEW_PASSPHRASE } },
      );
      return dialog;
    }

    it("shows the new recovery code only after the rotation commits, then starts the Re-seal", async () => {
      vi.mocked(rotateContentKey).mockResolvedValue({
        recoveryCode: "ROTA-TEDC-ODE0-0000-0000-0000-0000-0000",
        otherSessionsSignedOut: true,
      });
      const dialog = await reachPassphraseStep();
      expect(screen.queryByText(/ROTA-TEDC/)).not.toBeInTheDocument();

      fireEvent.click(
        within(dialog).getByRole("button", { name: "Rotate key" }),
      );

      expect(
        await screen.findByText("ROTA-TEDC-ODE0-0000-0000-0000-0000-0000"),
      ).toBeInTheDocument();
      expect(rotateContentKey).toHaveBeenCalledWith(
        "user-1",
        "the current passphrase",
        NEW_PASSPHRASE,
      );
      expect(beginReseal).toHaveBeenCalledTimes(1);
    });

    it("shows the error and no recovery code when the rotation fails", async () => {
      vi.mocked(rotateContentKey).mockRejectedValue(
        new Error("network dropped"),
      );
      const dialog = await reachPassphraseStep();

      fireEvent.click(
        within(dialog).getByRole("button", { name: "Rotate key" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "network dropped",
      );
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
      expect(beginReseal).not.toHaveBeenCalled();
    });

    it("warns when other sessions could not be signed out", async () => {
      vi.mocked(rotateContentKey).mockResolvedValue({
        recoveryCode: "ROTA-TEDC-ODE0-0000-0000-0000-0000-0000",
        otherSessionsSignedOut: false,
      });
      const dialog = await reachPassphraseStep();

      fireEvent.click(
        within(dialog).getByRole("button", { name: "Rotate key" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /sign out of them yourself/i,
      );
    });

    it("opens the same flow from the change-passphrase card", async () => {
      render(<EncryptionSection />);
      fireEvent.click(
        screen.getByRole("button", { name: "Also rotate my key" }),
      );
      expect(await screen.findByRole("dialog")).toHaveTextContent(
        /Rotate content key/,
      );
    });
  });
});
