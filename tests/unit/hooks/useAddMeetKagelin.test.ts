import { describe, it, expect, beforeEach, vi } from "vitest";
import { addMeetKagelinProject } from "@/lib/hooks/useAddMeetKagelin";
import { mockStore } from "@/lib/mock/mock-store";
import { wrapSupabaseClient } from "@/lib/supabase/wrapClient";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import { generateMasterKey } from "@/lib/crypto/masterKey";
import { isCiphertext } from "@/lib/crypto/contentCipher";
import { createFakeSupabaseClient } from "../support/fakeSupabaseClient";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";

const mockCreateClient = vi.mocked(createClient);

const keyStoreState: { key: Uint8Array | null } = { key: null };
vi.mock("@/lib/crypto/keyChainMark", () => ({
  keyChainMark: {
    load: vi.fn(async () => ({ keyId: 0, sealedV2: false })),
    raise: vi.fn(async () => {}),
  },
}));

vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: {
    load: vi.fn(async () => keyStoreState.key),
    loadKeyring: vi.fn(async () =>
      keyStoreState.key
        ? { keyId: "1", key: keyStoreState.key, retired: {} }
        : null,
    ),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  },
}));

describe("addMeetKagelinProject", () => {
  describe("guest", () => {
    beforeEach(() => {
      localStorage.setItem("kanso_guest_mode", "true");
      mockStore.clearData();
    });

    it("adds the Meet Kagelin project with its steps as the guest's own tasks", async () => {
      const project = await addMeetKagelinProject();

      expect(project.name).toBe("Meet Kagelin");
      const tasks = mockStore
        .getTasks()
        .filter((t) => t.project_id === project.id);
      const steps = tasks.filter((t) => !t.parent_id);
      expect(steps.map((t) => t.content)).toContain("Break into steps");
      expect(steps).toHaveLength(9);

      const parent = steps.find((t) => t.content === "Break into steps")!;
      expect(tasks.filter((t) => t.parent_id === parent.id)).toHaveLength(2);

      const weekly = steps.find((t) => t.content === "Plan your week")!;
      expect(weekly.recurrence).toEqual({ freq: "WEEKLY", interval: 1 });
      expect(new Date(weekly.due_date!).toDateString()).toBe(
        new Date().toDateString(),
      );

      // Chosen by the user, so Start fresh must not treat it as demo data.
      expect(mockStore.isSeedId(project.id)).toBe(false);
      expect(tasks.some((t) => mockStore.isSeedId(t.id))).toBe(false);
    });
  });

  describe("account, with real encryption", () => {
    beforeEach(async () => {
      localStorage.removeItem("kanso_guest_mode");
      keyStoreState.key = await generateMasterKey();
    });

    it("saves the project and steps through the normal path, encrypted", async () => {
      const raw = createFakeSupabaseClient({ projects: [], tasks: [] });
      mockCreateClient.mockReturnValue(wrapSupabaseClient(raw, FIELD_MAP));

      const project = await addMeetKagelinProject();

      expect(project.name).toBe("Meet Kagelin");
      const projectRow = raw.rawRows("projects")[0];
      expect(isCiphertext(projectRow.name as string)).toBe(true);
      const taskRows = raw.rawRows("tasks");
      expect(taskRows).toHaveLength(11);
      for (const row of taskRows) {
        expect(row.project_id).toBe(project.id);
        expect(isCiphertext(row.content as string)).toBe(true);
      }
    });
  });
});
