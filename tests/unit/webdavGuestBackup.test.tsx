/**
 * WebDAV Back Up / Restore is available to Guests too (CONTEXT.md → "WebDAV
 * backup"), reusing the same in-memory credentials field a registered user
 * uses. A Guest's data source is `mockStore`, never Supabase.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { parseBackupZip } from "@/lib/backup/export-import";

const GUEST_TASK = { id: "task-1", content: "Task in the Guest store" };

const mockSupabase = {
  from: vi.fn(() => ({
    upsert: vi.fn(async () => ({ error: null })),
    delete: () => ({ in: vi.fn(async () => ({ error: null })) }),
  })),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: null, isGuestMode: true }),
}));

const mockStoreSpy = vi.hoisted(() => ({
  getTasks: vi.fn(() => [{ id: "task-1", content: "Task in the Guest store" }]),
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

function openWebDav() {
  const tab = screen.getByRole("tab", { name: /webdav/i });
  fireEvent.mouseDown(tab);
  fireEvent.click(tab);
  fireEvent.change(screen.getByLabelText(/server url/i), {
    target: { value: "https://cloud.example.com/remote.php/dav/files/me" },
  });
}

describe("WebDAV backup for Guests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("shows the WebDAV tab and backs up the Guest store, not Supabase", async () => {
    renderSettings();
    openWebDav();

    fireEvent.click(screen.getByRole("button", { name: /back up/i }));

    await waitFor(() => expect(uploadWebDavBackup).toHaveBeenCalled());

    const payload = await parseBackupZip(uploadWebDavBackup.mock.calls[0][1]);
    expect(payload.tasks).toEqual([GUEST_TASK]);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("restores into the Guest store, not Supabase, once confirmed", async () => {
    renderSettings();
    openWebDav();

    fireEvent.click(screen.getByRole("button", { name: /restore/i }));
    fireEvent.click(await screen.findByRole("button", { name: /replace/i }));

    await waitFor(() => expect(mockStoreSpy.restoreBackup).toHaveBeenCalled());

    expect(mockStoreSpy.restoreBackup).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: [{ id: "remote-task", content: "Task from the WebDAV server" }],
      }),
    );
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
