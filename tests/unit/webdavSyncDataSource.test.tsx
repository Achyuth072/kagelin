/**
 * Regression lock for the WebDAV backup/restore data source, for registered
 * users specifically (see webdavGuestBackup.test.tsx for Guests).
 *
 * Both handlers used to read and write `mockStore` — the Guest-only local
 * store — regardless of tier, so Push uploaded an empty payload for a
 * registered user and Pull wrote somewhere the registered UI never reads.
 * These tests assert at the component seam, because the data layer was never
 * the bug: the wiring was.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { parseBackupZip } from "@/lib/backup/export-import";

const CLOUD_TASK = { id: "task-1", content: "Task that lives in Supabase" };

const supabaseWrites: {
  op: string;
  table: string;
  rows?: unknown[];
  ids?: string[];
}[] = [];

const mockSupabase = {
  from: vi.fn((table: string) => ({
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn(async (start: number) => ({
      data: start === 0 && table === "tasks" ? [CLOUD_TASK] : [],
      error: null,
    })),
    delete: () => ({
      in: async (_column: string, ids: string[]) => {
        supabaseWrites.push({ op: "delete", table, ids });
        return { error: null };
      },
    }),
    upsert: async (rows: unknown[]) => {
      supabaseWrites.push({ op: "upsert", table, rows });
      return { error: null };
    },
  })),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "user-1" }, isGuestMode: false }),
}));

const mockStoreSpy = vi.hoisted(() => ({
  getTasks: vi.fn(() => []),
  getProjects: vi.fn(() => []),
  getHabits: vi.fn(() => []),
  getHabitEntries: vi.fn(() => []),
  getFocusLogs: vi.fn(() => []),
  getEvents: vi.fn(() => []),
  restoreBackup: vi.fn(),
}));

vi.mock("@/lib/mock/mock-store", () => ({
  mockStore: mockStoreSpy,
}));

const uploadWebDavBackup = vi.fn(
  async (_credentials: unknown, _blob: Blob) => ({ success: true }),
);
const downloadWebDavBackup = vi.fn(async (_credentials: unknown) => ({
  success: true,
  data: {
    metadata: {
      version: 1,
      appVersion: "1.0.0",
      exportedAt: "2026-08-25T00:00:00.000Z",
    },
    tasks: [{ id: "remote-task", content: "Task from the WebDAV server" }],
    projects: [],
    habits: [],
    habit_entries: [],
    focus_logs: [],
    events: [],
  },
}));

vi.mock("@/lib/backup/webdav-sync", () => ({
  testWebDavConnection: vi.fn(async () => ({ success: true })),
  uploadWebDavBackup: (credentials: unknown, blob: Blob) =>
    uploadWebDavBackup(credentials, blob),
  downloadWebDavBackup: (credentials: unknown) =>
    downloadWebDavBackup(credentials),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => "toast-id"),
    promise: vi.fn((p) => p),
  },
}));

vi.mock("@/lib/hooks/useHaptic", () => ({
  useHaptic: () => ({
    trigger: vi.fn(),
    isPhone: false,
    hapticsEnabled: false,
  }),
}));

vi.mock("@/components/settings/ImportDialog", () => ({
  ImportDialog: () => null,
}));

import { BackupSyncSettings } from "@/components/settings/BackupSyncSettings";

function renderSettings() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<BackupSyncSettings />, { wrapper });
}

/** Opens the Cloud Sync tab and fills in the server URL the buttons require. */
function openCloudSync() {
  // Radix Tabs switch on mousedown, not click.
  const tab = screen.getByRole("tab", { name: /webdav/i });
  fireEvent.mouseDown(tab);
  fireEvent.click(tab);
  fireEvent.change(screen.getByLabelText(/server url/i), {
    target: { value: "https://cloud.example.com/remote.php/dav/files/me" },
  });
}

describe("WebDAV sync for registered users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseWrites.length = 0;
    // Desktop, so the confirmation renders as an AlertDialog rather than a Drawer.
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("min-width: 768px"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it("backs up the user's Supabase data, not the Guest store", async () => {
    renderSettings();
    openCloudSync();

    fireEvent.click(screen.getByRole("button", { name: /back up/i }));

    await waitFor(() => expect(uploadWebDavBackup).toHaveBeenCalled());

    const payload = await parseBackupZip(uploadWebDavBackup.mock.calls[0][1]);
    expect(payload.tasks).toEqual([CLOUD_TASK]);
    expect(mockStoreSpy.getTasks).not.toHaveBeenCalled();
  });

  it("restores into Supabase, not the Guest store", async () => {
    renderSettings();
    openCloudSync();

    fireEvent.click(screen.getByRole("button", { name: /restore/i }));
    fireEvent.click(await screen.findByRole("button", { name: /replace/i }));

    await waitFor(() => expect(downloadWebDavBackup).toHaveBeenCalled());

    await waitFor(() => {
      const taskWrite = supabaseWrites.find(
        (w) => w.op === "upsert" && w.table === "tasks",
      );
      expect(taskWrite?.rows).toEqual([
        expect.objectContaining({ id: "remote-task", user_id: "user-1" }),
      ]);
    });
    expect(mockStoreSpy.restoreBackup).not.toHaveBeenCalled();
  });

  it("downloads the backup to show its date, but does not write until the replace is confirmed", async () => {
    renderSettings();
    openCloudSync();

    fireEvent.click(screen.getByRole("button", { name: /restore/i }));

    // The date comes from a real download, made before confirmation.
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    await waitFor(() => expect(downloadWebDavBackup).toHaveBeenCalled());
    expect(screen.getByRole("alertdialog")).toHaveTextContent("2026");
    expect(supabaseWrites).toHaveLength(0);
  });
});
