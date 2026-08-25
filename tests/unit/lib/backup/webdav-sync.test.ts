import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  uploadWebDavBackup,
  downloadWebDavBackup,
  testWebDavConnection,
} from "@/lib/backup/webdav-sync";
import { createBackupZip } from "@/lib/backup/export-import";
import type { BackupData } from "@/lib/backup/types";

describe("webdav-sync", () => {
  const mockCredentials = {
    serverUrl: "https://dav.example.com",
    username: "testuser",
    password: "testpass",
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  describe("testWebDavConnection", () => {
    it("returns success for valid credentials", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await testWebDavConnection(mockCredentials);
      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/webdav/",
        expect.objectContaining({
          method: "OPTIONS",
          headers: expect.objectContaining({
            "X-WebDAV-URL": mockCredentials.serverUrl,
          }),
        }),
      );
    });

    it("returns error for invalid credentials", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await testWebDavConnection(mockCredentials);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid username or password");
    });
  });

  describe("uploadWebDavBackup", () => {
    it("uploads the backup ZIP to the correct path", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
      });

      const zipBlob = new Blob(["zip bytes"], { type: "application/zip" });
      await uploadWebDavBackup(mockCredentials, zipBlob);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/webdav/kanso-backup.zip"),
        expect.objectContaining({
          method: "PUT",
          body: zipBlob,
          headers: expect.objectContaining({
            "Content-Type": "application/zip",
            "X-WebDAV-URL": mockCredentials.serverUrl,
          }),
        }),
      );
    });
  });

  describe("downloadWebDavBackup", () => {
    const backupData: BackupData = {
      metadata: {
        version: 1,
        appVersion: "1.0.0",
        exportedAt: "2026-08-25T00:00:00.000Z",
      },
      tasks: [],
      projects: [],
      habits: [],
      habit_entries: [],
      focus_logs: [],
      events: [],
    };

    it("parses the downloaded ZIP into BackupData", async () => {
      const zipBlob = await createBackupZip(backupData);
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: async () => zipBlob,
      });

      const result = await downloadWebDavBackup(mockCredentials);

      expect(result.success).toBe(true);
      expect(result.data?.metadata.exportedAt).toBe(
        backupData.metadata.exportedAt,
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/webdav/kanso-backup.zip"),
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("returns an error when no backup exists on the server", async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await downloadWebDavBackup(mockCredentials);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No backup found");
    });
  });
});
