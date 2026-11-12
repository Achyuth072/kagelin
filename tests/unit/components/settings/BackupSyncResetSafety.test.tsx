import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { BackupSyncSettings } from "@/components/settings/BackupSyncSettings";

const mockNotifySuccess = vi.fn();

vi.mock("@/lib/notify", () => ({
  notify: {
    success: (...args: unknown[]) => mockNotifySuccess(...args),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => true),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ isGuestMode: false, user: { id: "user-123" } }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  }),
}));

describe("BackupSyncSettings WebDAV Reset Confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("kanso_webdav_url", "https://webdav.example.com");
    localStorage.setItem("kanso_webdav_username", "kanso_user");
    localStorage.setItem("kanso_webdav_password", "secret");
  });

  it("prompts confirmation before erasing WebDAV credentials and only clears upon confirm", async () => {
    render(<BackupSyncSettings />);

    // Switch to Cloud tab
    const cloudTab = screen.getByRole("tab", { name: /webdav/i });
    fireEvent.mouseDown(cloudTab);

    // Enter credentials so forget button appears
    const urlInput = screen.getByLabelText(/server url/i);
    fireEvent.change(urlInput, {
      target: { value: "https://webdav.example.com" },
    });

    const forgetBtn = screen.getByRole("button", {
      name: /forget credentials/i,
    });
    fireEvent.click(forgetBtn);

    // Should NOT have erased credentials or notified yet
    expect(mockNotifySuccess).not.toHaveBeenCalled();

    // Confirmation dialog should be open
    expect(screen.getByText("Forget WebDAV credentials?")).toBeDefined();
    expect(
      screen.getByText(
        /You will need to re-enter your server details to sync/i,
      ),
    ).toBeDefined();

    // Confirm forget
    const confirmBtn = screen.getByRole("button", { name: /^forget$/i });
    fireEvent.click(confirmBtn);

    expect(mockNotifySuccess).toHaveBeenCalledWith("Credentials cleared");
  });
});
