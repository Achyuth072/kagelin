import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { calendarEventMutations } from "@/lib/mutations/calendar-event";
import { mockStore, STORAGE_KEY } from "@/lib/mock/mock-store";

const input = {
  title: "Dentist",
  start_time: "2026-10-10T09:00:00Z",
  end_time: "2026-10-10T10:00:00Z",
};

function storedEvents() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").events ?? [];
}

describe("calendarEventMutations in guest mode", () => {
  beforeEach(() => {
    localStorage.clear();
    mockStore.clearData();
    localStorage.setItem("kanso_guest_mode", "true");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("create persists the event to the guest store", async () => {
    const created = await calendarEventMutations.create(input);

    expect(mockStore.getEvents()).toEqual([created]);
    expect(storedEvents()).toEqual([
      expect.objectContaining({ id: created.id, title: "Dentist" }),
    ]);
  });

  it("create keeps the caller's client id", async () => {
    const created = await calendarEventMutations.create({
      ...input,
      _clientId: "client-1",
    });

    expect(created.id).toBe("client-1");
    expect(mockStore.getEvents()[0].id).toBe("client-1");
  });

  it("update changes the stored event", async () => {
    const created = await calendarEventMutations.create(input);

    const updated = await calendarEventMutations.update({
      id: created.id,
      title: "Dentist (moved)",
    });

    expect(updated.title).toBe("Dentist (moved)");
    expect(mockStore.getEvents()[0].title).toBe("Dentist (moved)");
  });

  it("update of a missing event throws", async () => {
    await expect(
      calendarEventMutations.update({ id: "missing", title: "x" }),
    ).rejects.toThrow();
  });

  it("delete removes the event from the guest store", async () => {
    const created = await calendarEventMutations.create(input);

    await calendarEventMutations.delete(created.id);

    expect(mockStore.getEvents()).toEqual([]);
    expect(storedEvents()).toEqual([]);
  });
});
