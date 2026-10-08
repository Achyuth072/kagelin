import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_NOTIFICATION_OPTIONS,
  displayNotification,
  type NotificationDisplayOptions,
} from "@/lib/notifications";
import { encryptField } from "@/lib/crypto/contentCipher";
import { sealEnvelope, INITIAL_KEY_ID } from "@/lib/crypto/envelope";

const { loadKey } = vi.hoisted(() => ({
  loadKey: vi.fn<() => Promise<Uint8Array | null>>(),
}));

vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: {
    load: loadKey,
    loadKeyring: async () => {
      const key = await loadKey();
      return key ? { keyId: "1", key, retired: {} } : null;
    },
    loadUserId: vi.fn(async () => "user-1"),
    save: vi.fn(),
    clear: vi.fn(),
  },
}));

const markState = { sealedV2: false };
vi.mock("@/lib/crypto/keyChainMark", () => ({
  keyChainMark: {
    load: vi.fn(async () => ({ keyId: 0, sealedV2: markState.sealedV2 })),
  },
}));

function registrationWith(
  notifications: { close: () => void }[] | { rejects: Error },
) {
  return {
    getNotifications: vi.fn(() =>
      "rejects" in notifications
        ? Promise.reject(notifications.rejects)
        : Promise.resolve(notifications),
    ),
    showNotification: vi.fn().mockResolvedValue(undefined),
  } as unknown as ServiceWorkerRegistration;
}

beforeEach(() => {
  markState.sealedV2 = false;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("displayNotification", () => {
  it("closes the predecessors iOS would otherwise stack", async () => {
    const first = { close: vi.fn() };
    const second = { close: vi.fn() };
    const registration = registrationWith([first, second]);

    await displayNotification(registration, "Focus Complete", {
      tag: "timer_end",
    });

    expect(registration.getNotifications).toHaveBeenCalledWith({
      tag: "timer_end",
    });
    expect(first.close).toHaveBeenCalledOnce();
    expect(second.close).toHaveBeenCalledOnce();
    expect(registration.showNotification).toHaveBeenCalledOnce();
  });

  it("skips the lookup entirely for an untagged notification", async () => {
    const registration = registrationWith([]);

    await displayNotification(registration, "Focus Complete");

    expect(registration.getNotifications).not.toHaveBeenCalled();
    expect(registration.showNotification).toHaveBeenCalledOnce();
  });

  it("applies the shared defaults, letting callers override them", async () => {
    const registration = registrationWith([]);

    await displayNotification(registration, "Focus Complete", {
      icon: "/icons/custom.png",
    });

    expect(registration.showNotification).toHaveBeenCalledWith(
      "Focus Complete",
      expect.objectContaining({
        icon: "/icons/custom.png",
        badge: DEFAULT_NOTIFICATION_OPTIONS.badge,
        vibrate: DEFAULT_NOTIFICATION_OPTIONS.vibrate,
      }),
    );
  });

  it("still shows the notification when the engine cannot enumerate tags", async () => {
    const registration = registrationWith({
      rejects: new Error("not supported"),
    });

    await displayNotification(registration, "Focus Complete", {
      tag: "timer_end",
    });

    expect(registration.showNotification).toHaveBeenCalledOnce();
  });

  it("still shows the notification when closing throws part-way through", async () => {
    const registration = registrationWith([
      {
        close: vi.fn(() => {
          throw new Error("already dismissed");
        }),
      },
    ]);

    await displayNotification(registration, "Focus Complete", {
      tag: "timer_end",
    });

    expect(registration.showNotification).toHaveBeenCalledOnce();
  });
});

describe("displayNotification with an encrypted body", () => {
  const key = new Uint8Array(32).fill(7);

  function bodyShown(registration: ServiceWorkerRegistration): string {
    const showNotification = registration.showNotification as unknown as {
      mock: { calls: [string, { body?: string }][] };
    };
    return showNotification.mock.calls[0][1].body ?? "";
  }

  it("names the task when the key is present on this device", async () => {
    loadKey.mockResolvedValue(key);
    const registration = registrationWith([]);

    await displayNotification(registration, "Task Due Soon", {
      body: "You have a task due now.",
      encrypted: {
        template: 'Your task "{}" is due now.',
        ciphertext: await encryptField(key, "Renew passport"),
      },
    });

    expect(bodyShown(registration)).toBe(
      'Your task "Renew passport" is due now.',
    );
  });

  it("inserts a title containing $-sequences verbatim", async () => {
    loadKey.mockResolvedValue(key);
    const registration = registrationWith([]);

    await displayNotification(registration, "Task Due Soon", {
      body: "You have a task due now.",
      encrypted: {
        template: 'Your task "{}" is due now.',
        ciphertext: await encryptField(key, "Pay $$ rent"),
      },
    });

    expect(bodyShown(registration)).toBe('Your task "Pay $$ rent" is due now.');
  });

  it("degrades to the count fallback when no key is available", async () => {
    loadKey.mockResolvedValue(null);
    const registration = registrationWith([]);

    await displayNotification(registration, "Task Due Soon", {
      body: "You have a task due now.",
      encrypted: {
        template: 'Your task "{}" is due now.',
        ciphertext: await encryptField(key, "Renew passport"),
      },
    });

    expect(registration.showNotification).toHaveBeenCalledOnce();
    expect(bodyShown(registration)).toBe("You have a task due now.");
  });

  it("degrades to the count fallback when the ciphertext does not decrypt", async () => {
    loadKey.mockResolvedValue(new Uint8Array(32).fill(9));
    const registration = registrationWith([]);

    await displayNotification(registration, "Task Due Soon", {
      body: "You have a task due now.",
      encrypted: {
        template: 'Your task "{}" is due now.',
        ciphertext: await encryptField(key, "Renew passport"),
      },
    });

    expect(registration.showNotification).toHaveBeenCalledOnce();
    expect(bodyShown(registration)).toBe("You have a task due now.");
  });

  it("keeps the ciphertext out of the shown notification options", async () => {
    loadKey.mockResolvedValue(key);
    const registration = registrationWith([]);

    await displayNotification(registration, "Task Due Soon", {
      body: "You have a task due now.",
      encrypted: {
        template: 'Your task "{}" is due now.',
        ciphertext: await encryptField(key, "Renew passport"),
      },
    });

    expect(registration.showNotification).toHaveBeenCalledWith(
      "Task Due Soon",
      expect.not.objectContaining({ encrypted: expect.anything() }),
    );
  });
});

describe("displayNotification with an encrypted title", () => {
  const key = new Uint8Array(32).fill(7);

  function titleShown(registration: ServiceWorkerRegistration): string {
    const showNotification = registration.showNotification as unknown as {
      mock: { calls: [string, NotificationDisplayOptions][] };
    };
    return showNotification.mock.calls[0][0];
  }

  it("uses the decrypted habit name as the title when key is present", async () => {
    loadKey.mockResolvedValue(key);
    const registration = registrationWith([]);

    await displayNotification(registration, "Habit reminder", {
      body: "You have a habit scheduled now.",
      encryptedTitle: {
        template: "{}",
        ciphertext: await encryptField(key, "Morning run"),
      },
    });

    expect(titleShown(registration)).toBe("Morning run");
  });

  it("falls back to the generic title when no key is loaded (locked account)", async () => {
    loadKey.mockResolvedValue(null);
    const registration = registrationWith([]);

    await displayNotification(registration, "Habit reminder", {
      body: "You have a habit scheduled now.",
      encryptedTitle: {
        template: "{}",
        ciphertext: await encryptField(key, "Morning run"),
      },
    });

    expect(titleShown(registration)).toBe("Habit reminder");
  });

  it("falls back to the generic title when the ciphertext does not decrypt", async () => {
    loadKey.mockResolvedValue(new Uint8Array(32).fill(9));
    const registration = registrationWith([]);

    await displayNotification(registration, "Habit reminder", {
      body: "You have a habit scheduled now.",
      encryptedTitle: {
        template: "{}",
        ciphertext: await encryptField(key, "Morning run"),
      },
    });

    expect(titleShown(registration)).toBe("Habit reminder");
  });

  it("keeps the encrypted title envelope out of the shown notification options", async () => {
    loadKey.mockResolvedValue(key);
    const registration = registrationWith([]);

    await displayNotification(registration, "Habit reminder", {
      body: "You have a habit scheduled now.",
      encryptedTitle: {
        template: "{}",
        ciphertext: await encryptField(key, "Morning run"),
      },
    });

    expect(registration.showNotification).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.objectContaining({ encryptedTitle: expect.anything() }),
    );
  });

  it("does not expose ciphertext as the title on decrypt failure", async () => {
    loadKey.mockResolvedValue(new Uint8Array(32).fill(9));
    const registration = registrationWith([]);
    const ciphertext = await encryptField(key, "Morning run");

    await displayNotification(registration, "Habit reminder", {
      body: "You have a habit scheduled now.",
      encryptedTitle: {
        template: "{}",
        ciphertext,
      },
    });

    expect(titleShown(registration)).not.toContain("xchacha20");
    expect(titleShown(registration)).toBe("Habit reminder");
  });
});

describe("displayNotification habit actions", () => {
  const key = new Uint8Array(32).fill(7);

  function actionsShown(
    registration: ServiceWorkerRegistration,
  ): Array<{ action: string; title: string }> | undefined {
    const showNotification = registration.showNotification as unknown as {
      mock: { calls: [string, NotificationDisplayOptions][] };
    };
    return showNotification.mock.calls[0][1].actions as
      Array<{ action: string; title: string }> | undefined;
  }

  it("adds Done and Skip for a boolean habit when the key is loaded", async () => {
    loadKey.mockResolvedValue(key);
    const registration = registrationWith([]);

    await displayNotification(registration, "Habit reminder", {
      body: "Time to check in.",
      encryptedTitle: {
        template: "{}",
        ciphertext: await encryptField(key, "Morning run"),
      },
      habitKind: "boolean",
    });

    expect(actionsShown(registration)).toEqual([
      { action: "done", title: "Done" },
      { action: "skip", title: "Skip" },
    ]);
  });

  it("adds only Skip for a measurable habit when the key is loaded", async () => {
    loadKey.mockResolvedValue(key);
    const registration = registrationWith([]);

    await displayNotification(registration, "Habit reminder", {
      body: "Time to check in.",
      encryptedTitle: {
        template: "{}",
        ciphertext: await encryptField(key, "Pushups"),
      },
      habitKind: "measurable",
    });

    expect(actionsShown(registration)).toEqual([
      { action: "skip", title: "Skip" },
    ]);
  });

  it("adds no actions when the payload has no encrypted title to prove the key", async () => {
    loadKey.mockResolvedValue(key);
    const registration = registrationWith([]);

    await displayNotification(registration, "Habit reminder", {
      body: "Time to check in.",
      habitKind: "boolean",
    });

    expect(actionsShown(registration)).toBeUndefined();
  });

  it("adds no actions when no key is loaded (locked account)", async () => {
    loadKey.mockResolvedValue(null);
    const registration = registrationWith([]);

    await displayNotification(registration, "Habit reminder", {
      body: "Time to check in.",
      encryptedTitle: {
        template: "{}",
        ciphertext: await encryptField(key, "Morning run"),
      },
      habitKind: "boolean",
    });

    expect(actionsShown(registration)).toBeUndefined();
  });

  it("adds no actions when decryption fails (wrong key)", async () => {
    loadKey.mockResolvedValue(new Uint8Array(32).fill(9));
    const registration = registrationWith([]);

    await displayNotification(registration, "Habit reminder", {
      body: "Time to check in.",
      encryptedTitle: {
        template: "{}",
        ciphertext: await encryptField(key, "Morning run"),
      },
      habitKind: "boolean",
    });

    expect(actionsShown(registration)).toBeUndefined();
  });

  it("adds no actions when habitKind is not set", async () => {
    loadKey.mockResolvedValue(key);
    const registration = registrationWith([]);

    await displayNotification(registration, "Habit reminder", {
      body: "Time to check in.",
    });

    expect(actionsShown(registration)).toBeUndefined();
  });

  it("keeps the habitKind out of the shown notification options", async () => {
    loadKey.mockResolvedValue(key);
    const registration = registrationWith([]);

    await displayNotification(registration, "Habit reminder", {
      body: "Time to check in.",
      habitKind: "boolean",
    });

    expect(registration.showNotification).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.objectContaining({ habitKind: expect.anything() }),
    );
  });
});

describe("displayNotification task and event actions", () => {
  const key = new Uint8Array(32).fill(7);

  async function shownActions(
    options: NotificationDisplayOptions,
    loaded: Uint8Array | null = key,
  ) {
    loadKey.mockResolvedValue(loaded);
    const registration = registrationWith([]);
    await displayNotification(registration, "Task Due Soon", {
      body: "You have a task due now.",
      encrypted: {
        template: 'Your task "{}" is due now.',
        ciphertext: await encryptField(key, "Write report"),
      },
      ...options,
    });
    const showNotification = registration.showNotification as unknown as {
      mock: { calls: [string, NotificationDisplayOptions][] };
    };
    return showNotification.mock.calls[0][1].actions;
  }

  it("adds Done and Snooze for a one-off task reminder", async () => {
    expect(await shownActions({ reminderType: "due_date" })).toEqual([
      { action: "done", title: "Done" },
      { action: "snooze", title: "Snooze" },
    ]);
  });

  it("adds only Snooze for a recurring task reminder", async () => {
    expect(
      await shownActions({ reminderType: "do_date", recurring: true }),
    ).toEqual([{ action: "snooze", title: "Snooze" }]);
  });

  it("adds only Snooze for an event reminder", async () => {
    expect(await shownActions({ reminderType: "event_reminder" })).toEqual([
      { action: "snooze", title: "Snooze" },
    ]);
  });

  it("adds no actions when no key is loaded (locked account)", async () => {
    expect(
      await shownActions({ reminderType: "due_date" }, null),
    ).toBeUndefined();
  });

  it("adds no actions when decryption fails (wrong key)", async () => {
    expect(
      await shownActions(
        { reminderType: "due_date" },
        new Uint8Array(32).fill(9),
      ),
    ).toBeUndefined();
  });

  it("adds no actions without an encrypted body to prove the key", async () => {
    expect(
      await shownActions({ reminderType: "due_date", encrypted: undefined }),
    ).toBeUndefined();
  });

  it("adds no actions when reminderType is not set", async () => {
    expect(await shownActions({})).toBeUndefined();
  });

  it("keeps reminderType and recurring out of the shown options", async () => {
    loadKey.mockResolvedValue(key);
    const registration = registrationWith([]);

    await displayNotification(registration, "Task Due Soon", {
      body: "You have a task due now.",
      reminderType: "due_date",
      recurring: true,
    });

    expect(registration.showNotification).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.objectContaining({
        reminderType: expect.anything(),
        recurring: expect.anything(),
      }),
    );
  });
});

describe("displayNotification with row-bound (-v2) ciphertext", () => {
  const key = new Uint8Array(32).fill(7);

  const sealFor = (
    table: string,
    column: string,
    rowId: string,
    text: string,
  ) =>
    sealEnvelope(key, new TextEncoder().encode(text), INITIAL_KEY_ID, {
      userId: "user-1",
      table,
      column,
      rowId,
    });

  function shown(registration: ServiceWorkerRegistration) {
    const showNotification = registration.showNotification as unknown as {
      mock: { calls: [string, { body?: string }][] };
    };
    return showNotification.mock.calls[0];
  }

  beforeEach(() => {
    loadKey.mockResolvedValue(key);
  });

  it("decrypts a task payload using the source-row binding", async () => {
    const registration = registrationWith([]);

    await displayNotification(registration, "Task Due Soon", {
      body: "You have a task due now.",
      data: { taskId: "task-1" },
      encrypted: {
        template: 'Your task "{}" is due now.',
        ciphertext: await sealFor(
          "tasks",
          "content",
          "task-1",
          "Renew passport",
        ),
      },
    });

    expect(shown(registration)[1].body).toBe(
      'Your task "Renew passport" is due now.',
    );
  });

  it("decrypts a habit payload's name and question with their own columns", async () => {
    const registration = registrationWith([]);

    await displayNotification(registration, "Habit reminder", {
      body: "You have a habit scheduled now.",
      data: { habitId: "habit-1" },
      encryptedTitle: {
        template: "{}",
        ciphertext: await sealFor("habits", "name", "habit-1", "Meditate"),
      },
      encrypted: {
        template: "{}",
        ciphertext: await sealFor(
          "habits",
          "question",
          "habit-1",
          "Did you sit?",
        ),
      },
    });

    const [title, options] = shown(registration);
    expect(title).toBe("Meditate");
    expect(options.body).toBe("Did you sit?");
  });

  it("falls back to generic copy for a task payload lifted from another row", async () => {
    const registration = registrationWith([]);

    await displayNotification(registration, "Task Due Soon", {
      body: "You have a task due now.",
      data: { taskId: "task-2" },
      encrypted: {
        template: 'Your task "{}" is due now.',
        ciphertext: await sealFor(
          "tasks",
          "content",
          "task-1",
          "Renew passport",
        ),
      },
    });

    expect(shown(registration)[1].body).toBe("You have a task due now.");
  });

  it("falls back to generic copy for a habit payload lifted from another row", async () => {
    const registration = registrationWith([]);

    await displayNotification(registration, "Habit reminder", {
      body: "Time to check in.",
      data: { habitId: "habit-2" },
      encryptedTitle: {
        template: "{}",
        ciphertext: await sealFor("habits", "name", "habit-1", "Meditate"),
      },
    });

    expect(shown(registration)[0]).toBe("Habit reminder");
  });

  it("falls back to generic copy when the payload names no source row", async () => {
    const registration = registrationWith([]);

    await displayNotification(registration, "Task Due Soon", {
      body: "You have a task due now.",
      encrypted: {
        template: "{}",
        ciphertext: await sealFor(
          "tasks",
          "content",
          "task-1",
          "Renew passport",
        ),
      },
    });

    expect(shown(registration)[1].body).toBe("You have a task due now.");
  });

  it("after a finished Re-seal, falls back to generic copy for a -v1 payload", async () => {
    markState.sealedV2 = true;
    const registration = registrationWith([]);

    await displayNotification(registration, "Task Due Soon", {
      body: "You have a task due now.",
      data: { taskId: "task-1" },
      encrypted: {
        template: 'Your task "{}" is due now.',
        ciphertext: await encryptField(key, "Planted"),
      },
    });

    expect(shown(registration)[1].body).toBe("You have a task due now.");
  });
});
