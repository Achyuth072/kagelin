import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BackupSyncSettings } from "@/components/settings/BackupSyncSettings";

const useAuthMock = vi.fn();

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: vi.fn() }),
}));

vi.mock("@/lib/hooks/useAccountData", () => ({
  useAccountData: () => ({ exportData: vi.fn(), importData: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

// ImportDialog pulls in habit-import mutations that need a real
// QueryClientProvider; irrelevant to the tab-gating behavior under test.
vi.mock("@/components/settings/ImportDialog", () => ({
  ImportDialog: () => null,
}));

describe("BackupSyncSettings", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthMock.mockReset();
  });

  it("hides the Cloud Sync tab for guests, keeping only local ZIP export/import", () => {
    useAuthMock.mockReturnValue({ isGuestMode: true });
    render(<BackupSyncSettings />);

    expect(screen.getByText("Local Storage")).toBeInTheDocument();
    expect(screen.queryByText("Cloud Sync")).not.toBeInTheDocument();
    expect(screen.queryByText("WebDAV Sync")).not.toBeInTheDocument();
  });

  it("shows the Cloud Sync tab for registered users", () => {
    useAuthMock.mockReturnValue({ isGuestMode: false });
    render(<BackupSyncSettings />);

    expect(screen.getByText("Local Storage")).toBeInTheDocument();
    expect(screen.getByText("Cloud Sync")).toBeInTheDocument();
  });

  it("never writes WebDAV credentials to localStorage", () => {
    useAuthMock.mockReturnValue({ isGuestMode: false });
    render(<BackupSyncSettings />);

    expect(localStorage.getItem("kanso_webdav_credentials")).toBeNull();
  });
});
