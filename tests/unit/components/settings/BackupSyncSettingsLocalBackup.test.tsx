import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BackupSyncSettings } from "@/components/settings/BackupSyncSettings";

const useAuthMock = vi.fn();
const mockTrigger = vi.fn();

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({ trigger: mockTrigger }),
}));

vi.mock("@/lib/hooks/useAccountData", () => ({
  useAccountData: () => ({ exportData: vi.fn(), importData: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const mockAppMigrationDialogOpen = vi.fn();
vi.mock("@/components/settings/AppMigrationDialog", () => ({
  AppMigrationDialog: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => {
    mockAppMigrationDialogOpen(open);
    return open ? (
      <div data-testid="app-migration-dialog">
        <button onClick={() => onOpenChange(false)}>Close Dialog</button>
      </div>
    ) : null;
  },
  ImportDialog: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => {
    mockAppMigrationDialogOpen(open);
    return open ? (
      <div data-testid="app-migration-dialog">
        <button onClick={() => onOpenChange(false)}>Close Dialog</button>
      </div>
    ) : null;
  },
}));

describe("BackupSyncSettings Local Backup Card", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthMock.mockReset();
    mockTrigger.mockReset();
    mockAppMigrationDialogOpen.mockReset();
  });

  it("renders Local Backup card without inline Loop controls", () => {
    useAuthMock.mockReturnValue({ isGuestMode: false });
    render(<BackupSyncSettings />);

    // Native Backup & Restore actions should exist
    expect(
      screen.getByRole("button", { name: /^export$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^import$/i }),
    ).toBeInTheDocument();

    // Inline Loop controls should NOT exist
    expect(screen.queryByText("Loop Habit Tracker")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /import \(\.db\)/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /export \(\.db\)/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /export \(csv zip\)/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Import Loop (.db) file"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /import from other apps/i }),
    ).not.toBeInTheDocument();
  });

  it("renders accessible migration trigger with correct copy, touch target and accessibility attributes", () => {
    useAuthMock.mockReturnValue({ isGuestMode: false });
    render(<BackupSyncSettings />);

    const triggerBtn = screen.getByRole("button", {
      name: /third-party app migration/i,
    });
    expect(triggerBtn).toBeInTheDocument();

    expect(screen.getByText("Third-party app migration")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Import and export with Loop Habit Tracker, Todoist, and Calendar",
      ),
    ).toBeInTheDocument();

    // WCAG 2.1 AA min touch target class check
    expect(triggerBtn.className).toContain("min-h-[44px]");
    expect(triggerBtn.tagName).toBe("BUTTON");
    expect(triggerBtn).toHaveAttribute("type", "button");
  });

  it("opens AppMigrationDialog and triggers haptic on click", () => {
    useAuthMock.mockReturnValue({ isGuestMode: false });
    render(<BackupSyncSettings />);

    const triggerBtn = screen.getByRole("button", {
      name: /third-party app migration/i,
    });

    expect(
      screen.queryByTestId("app-migration-dialog"),
    ).not.toBeInTheDocument();

    fireEvent.click(triggerBtn);

    expect(mockTrigger).toHaveBeenCalledWith("toggle");
    expect(screen.getByTestId("app-migration-dialog")).toBeInTheDocument();
  });

  it("opens AppMigrationDialog on Enter and Space keypress", () => {
    useAuthMock.mockReturnValue({ isGuestMode: false });
    render(<BackupSyncSettings />);

    const triggerBtn = screen.getByRole("button", {
      name: /third-party app migration/i,
    });

    fireEvent.keyDown(triggerBtn, { key: "Enter" });
    expect(mockTrigger).toHaveBeenCalledWith("toggle");
    expect(screen.getByTestId("app-migration-dialog")).toBeInTheDocument();

    // Close dialog
    fireEvent.click(screen.getByText("Close Dialog"));
    expect(
      screen.queryByTestId("app-migration-dialog"),
    ).not.toBeInTheDocument();

    // Space key
    mockTrigger.mockReset();
    fireEvent.keyDown(triggerBtn, { key: " " });
    expect(mockTrigger).toHaveBeenCalledWith("toggle");
    expect(screen.getByTestId("app-migration-dialog")).toBeInTheDocument();
  });
});
