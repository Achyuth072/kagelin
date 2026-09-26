import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_NOTIFICATION_OPTIONS,
  displayNotification,
  type NotificationDisplayOptions,
} from "@/lib/notifications";
import { encryptField } from "@/lib/crypto/contentCipher";

const { loadKey } = vi.hoisted(() => ({
  loadKey: vi.fn<() => Promise<Uint8Array | null>>(),
}));

vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: { load: loadKey, save: vi.fn(), clear: vi.fn() },
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
