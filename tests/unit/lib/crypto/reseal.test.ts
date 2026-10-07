import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  findPendingQueueRows,
  findPendingRows,
  runReseal,
} from "@/lib/crypto/reseal";
import { wrapSupabaseClient } from "@/lib/supabase/wrapClient";
import { FIELD_MAP } from "@/lib/supabase/fieldMap";
import {
  isCiphertext,
  encryptField,
  decryptField,
} from "@/lib/crypto/contentCipher";
import { generateMasterKey } from "@/lib/crypto/masterKey";
import {
  createFakeSupabaseClient,
  type Row,
} from "../../support/fakeSupabaseClient";

const keyStoreState: {
  key: Uint8Array | null;
  keyId: string;
  retired: Record<string, Uint8Array>;
} = { key: null, keyId: "1", retired: {} };
vi.mock("@/lib/crypto/keyStore", () => ({
  keyStore: {
    load: vi.fn(async () => keyStoreState.key),
    loadKeyring: vi.fn(async () =>
      keyStoreState.key
        ? {
            keyId: keyStoreState.keyId,
            key: keyStoreState.key,
            retired: keyStoreState.retired,
          }
        : null,
    ),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  },
}));

let fakeClient: ReturnType<typeof createFakeSupabaseClient>;
vi.mock("@/lib/supabase/client", () => ({
  createRawClient: () => fakeClient,
}));

const USER_ID = "user-1";

const sealed = (table: string, column: string, rowId: string, text: string) =>
  encryptField(keyStoreState.key!, text, {
    userId: USER_ID,
    table,
    column,
    rowId,
  });

// Replaces rather than mutates so the read snapshot stays stale like a network read.
function withEditAfterRead(
  base: ReturnType<typeof createFakeSupabaseClient>,
  table: string,
  edit: (stored: Row) => Row,
) {
  let applied = false;
  return {
    ...base,
    from: (name: string) => {
      const builder = base.from(name);
      if (name !== table) return builder;
      return {
        ...builder,
        select: (...args: unknown[]) => {
          const api = builder.select(...args);
          const originalThen = api.then.bind(api);
          api.then = (onFulfilled: unknown, onRejected: unknown) =>
            originalThen((result: unknown) => {
              if (!applied) {
                applied = true;
                const rows = base.rawRows(table);
                rows[0] = edit(rows[0]);
              }
              return (onFulfilled as (v: unknown) => unknown)(result);
            }, onRejected);
          return api;
        },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(async () => {
  keyStoreState.key = await generateMasterKey();
  keyStoreState.keyId = "1";
  keyStoreState.retired = {};
});

describe("runReseal", () => {
  it("encrypts every mapped field, across every field-map table, for the owning user", async () => {
    fakeClient = createFakeSupabaseClient({
      tasks: [
        {
          id: "t1",
          user_id: USER_ID,
          content: "Buy milk",
          description: "2%",
        },
      ],
      habits: [
        { id: "h1", user_id: USER_ID, name: "Meditate", description: null },
      ],
      projects: [{ id: "p1", user_id: USER_ID, name: "Divorce planning" }],
    });

    const progressCalls: Array<{ done: number; total: number }> = [];
    await runReseal(USER_ID, (p) =>
      progressCalls.push({ done: p.done, total: p.total }),
    );

    const task = fakeClient.rawRows("tasks")[0];
    expect(isCiphertext(task.content)).toBe(true);
    expect(isCiphertext(task.description)).toBe(true);

    const habit = fakeClient.rawRows("habits")[0];
    expect(isCiphertext(habit.name)).toBe(true);
    expect(habit.description).toBeNull();

    const project = fakeClient.rawRows("projects")[0];
    expect(isCiphertext(project.name)).toBe(true);

    expect(progressCalls.at(-1)).toEqual({ done: 3, total: 3 });
  });

  it("skips rows that only belong to a different user", async () => {
    fakeClient = createFakeSupabaseClient({
      tasks: [
        { id: "t1", user_id: "someone-else", content: "Not mine" },
        { id: "t2", user_id: USER_ID, content: "Mine" },
      ],
    });

    await runReseal(USER_ID);

    const rows = fakeClient.rawRows("tasks");
    expect(rows.find((r: Row) => r.id === "t1").content).toBe("Not mine");
    expect(isCiphertext(rows.find((r: Row) => r.id === "t2").content)).toBe(
      true,
    );
  });

  it("JSON fields: stringifies before encrypting and leaves null untouched", async () => {
    fakeClient = createFakeSupabaseClient({
      calendar_events: [
        {
          id: "e1",
          user_id: USER_ID,
          title: "Therapy",
          description: null,
          location: null,
          category: null,
          metadata: { attendees: ["a@example.com"] },
        },
      ],
      habit_imports: [
        {
          id: "i1",
          user_id: USER_ID,
          raw: { entries: [1, 2, 3] },
          file_name: "export.db",
        },
      ],
    });

    await runReseal(USER_ID);

    const event = fakeClient.rawRows("calendar_events")[0];
    expect(isCiphertext(event.title)).toBe(true);
    expect(isCiphertext(event.metadata)).toBe(true);
    expect(event.description).toBeNull();

    const habitImport = fakeClient.rawRows("habit_imports")[0];
    expect(isCiphertext(habitImport.raw)).toBe(true);
    expect(isCiphertext(habitImport.file_name)).toBe(true);
  });

  it("encrypts habit_entries notes, which are owned through the parent habit rather than a user_id column", async () => {
    fakeClient = createFakeSupabaseClient({
      habits: [
        { id: "h1", user_id: USER_ID, name: "Run", description: null },
        {
          id: "h2",
          user_id: "someone-else",
          name: "Swim",
          description: null,
        },
      ],
      habit_entries: [
        { id: "e1", habit_id: "h1", notes: "Knee felt sore" },
        { id: "e2", habit_id: "h1", notes: null },
        { id: "e3", habit_id: "h2", notes: "Not mine" },
      ],
    });

    await runReseal(USER_ID);

    const entries = fakeClient.rawRows("habit_entries");
    expect(isCiphertext(entries.find((r: Row) => r.id === "e1").notes)).toBe(
      true,
    );
    expect(entries.find((r: Row) => r.id === "e2").notes).toBeNull();
    expect(entries.find((r: Row) => r.id === "e3").notes).toBe("Not mine");
  });

  it("is resumable: an interrupted pass can be re-run and every row ends encrypted exactly once", async () => {
    let updatesAllowed = 1;
    fakeClient = createFakeSupabaseClient(
      {
        tasks: [
          { id: "t1", user_id: USER_ID, content: "First" },
          { id: "t2", user_id: USER_ID, content: "Second" },
          { id: "t3", user_id: USER_ID, content: "Third" },
        ],
      },
      {
        failWrite: (ctx) => {
          if (ctx.table === "tasks" && ctx.kind === "update") {
            if (updatesAllowed-- <= 0) return { message: "interrupted" };
          }
          return null;
        },
      },
    );

    await expect(runReseal(USER_ID)).rejects.toBeTruthy();

    const midway = fakeClient.rawRows("tasks");
    const encryptedCount = midway.filter((r: Row) =>
      isCiphertext(r.content),
    ).length;
    expect(encryptedCount).toBe(1);

    fakeClient = createFakeSupabaseClient({ tasks: midway });
    await runReseal(USER_ID);

    const final = fakeClient.rawRows("tasks");
    expect(final.every((r: Row) => isCiphertext(r.content))).toBe(true);
    expect(final.map((r: Row) => r.id).sort()).toEqual(["t1", "t2", "t3"]);
  });

  it("leaves a row alone that is already sealed row-bound under the current key", async () => {
    const alreadyEncrypted = await sealed(
      "tasks",
      "content",
      "t1",
      "already migrated",
    );
    fakeClient = createFakeSupabaseClient({
      tasks: [{ id: "t1", user_id: USER_ID, content: alreadyEncrypted }],
    });

    await runReseal(USER_ID);

    expect(fakeClient.rawRows("tasks")[0].content).toBe(alreadyEncrypted);
  });

  it("throws rather than silently skipping when the key is unavailable", async () => {
    keyStoreState.key = null;
    fakeClient = createFakeSupabaseClient({
      tasks: [{ id: "t1", user_id: USER_ID, content: "plaintext" }],
    });

    await expect(runReseal(USER_ID)).rejects.toThrow();
    expect(fakeClient.rawRows("tasks")[0].content).toBe("plaintext");
  });

  it("never touches a table outside the field map, such as profiles carrying is_premium", async () => {
    fakeClient = createFakeSupabaseClient({
      tasks: [{ id: "t1", user_id: USER_ID, content: "Task" }],
      profiles: [{ id: USER_ID, is_premium: true, display_name: "Ada" }],
    });

    await runReseal(USER_ID);

    expect(FIELD_MAP.profiles).toBeUndefined();
    expect(fakeClient.rawRows("profiles")[0]).toEqual({
      id: USER_ID,
      is_premium: true,
      display_name: "Ada",
    });
  });

  it("guards against a concurrent edit: a row changed after it was read is left alone rather than clobbered", async () => {
    const base = createFakeSupabaseClient({
      tasks: [{ id: "t1", user_id: USER_ID, content: "old", updated_at: "t0" }],
    });

    let concurrentEditApplied = false;
    const concurrentContent = await sealed(
      "tasks",
      "content",
      "t1",
      "edited from another device",
    );
    fakeClient = {
      ...base,
      from: (table: string) => {
        const builder = base.from(table);
        if (table !== "tasks") return builder;
        return {
          ...builder,
          select: (...args: unknown[]) => {
            const api = builder.select(...args);
            const originalThen = api.then.bind(api);
            api.then = (onFulfilled: unknown, onRejected: unknown) =>
              originalThen((result: unknown) => {
                if (!concurrentEditApplied) {
                  concurrentEditApplied = true;
                  const stored = base.rawRows("tasks")[0];
                  stored.content = concurrentContent;
                  stored.updated_at = "t1";
                }
                return (onFulfilled as (v: unknown) => unknown)(result);
              }, onRejected);
            return api;
          },
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await runReseal(USER_ID);

    const stored = fakeClient.rawRows("tasks")[0];
    expect(stored.content).toBe(concurrentContent);
    expect(stored.updated_at).toBe("t1");
  });

  it("guards habit_entries, which lack updated_at: a note edited after it was read is left alone rather than clobbered", async () => {
    const base = createFakeSupabaseClient({
      habits: [{ id: "h1", user_id: USER_ID, name: "Run", description: null }],
      habit_entries: [{ id: "e1", habit_id: "h1", notes: "Knee sore" }],
    });

    const concurrentNotes = await sealed(
      "habit_entries",
      "notes",
      "e1",
      "Knee fine",
    );
    fakeClient = withEditAfterRead(base, "habit_entries", (stored) => ({
      ...stored,
      notes: concurrentNotes,
    }));

    await expect(runReseal(USER_ID)).rejects.toThrow(/Re-seal conflict/);

    expect(base.rawRows("habit_entries")[0].notes).toBe(concurrentNotes);
  });

  it("guards labels, which lack updated_at: a name edited after it was read is left alone rather than clobbered", async () => {
    const base = createFakeSupabaseClient({
      labels: [{ id: "l1", user_id: USER_ID, name: "Health" }],
    });

    const concurrentName = await sealed("labels", "name", "l1", "Fitness");
    fakeClient = withEditAfterRead(base, "labels", (stored) => ({
      ...stored,
      name: concurrentName,
    }));

    await expect(runReseal(USER_ID)).rejects.toThrow(/Re-seal conflict/);

    expect(base.rawRows("labels")[0].name).toBe(concurrentName);
  });

  it("reports progress incrementally rather than only at the end", async () => {
    fakeClient = createFakeSupabaseClient({
      tasks: [
        { id: "t1", user_id: USER_ID, content: "One" },
        { id: "t2", user_id: USER_ID, content: "Two" },
      ],
    });

    const calls: number[] = [];
    await runReseal(USER_ID, (p) => calls.push(p.done));

    expect(calls).toContain(1);
    expect(calls).toContain(2);
  });

  it("cancels a pending notification queued before content encryption without touching an already-encrypted one", async () => {
    fakeClient = createFakeSupabaseClient({
      notification_queue: [
        {
          id: "n1",
          user_id: USER_ID,
          type: "due_date",
          status: "pending",
          payload: { body: "Your task is due now." },
        },
        {
          id: "n2",
          user_id: USER_ID,
          type: "due_date",
          status: "pending",
          payload: {
            body: "You have a task due now.",
            encrypted: {
              template: 'Your task "{}" is due now.',
              ciphertext: "x",
            },
          },
        },
        {
          id: "n3",
          user_id: "someone-else",
          type: "due_date",
          status: "pending",
          payload: { body: "Your task is due now." },
        },
      ],
    });

    await runReseal(USER_ID);

    const rows = fakeClient.rawRows("notification_queue");
    expect(rows.find((r: Row) => r.id === "n1").status).toBe("cancelled");
    expect(rows.find((r: Row) => r.id === "n2").status).toBe("pending");
    expect(rows.find((r: Row) => r.id === "n3").status).toBe("pending");
  });

  it("does not clobber a notification the queue worker delivers between the read and the cancel", async () => {
    const base = createFakeSupabaseClient({
      notification_queue: [
        {
          id: "n1",
          user_id: USER_ID,
          type: "due_date",
          status: "pending",
          payload: { body: "Your task is due now." },
        },
      ],
    });

    fakeClient = {
      ...base,
      from: (table: string) => {
        const builder = base.from(table);
        if (table !== "notification_queue") return builder;
        return {
          ...builder,
          select: (...args: unknown[]) => {
            const api = builder.select(...args);
            const originalThen = api.then.bind(api);
            api.then = (onFulfilled: unknown, onRejected: unknown) =>
              originalThen((result: unknown) => {
                base.rawRows("notification_queue")[0].status = "sent";
                return (onFulfilled as (v: unknown) => unknown)(result);
              }, onRejected);
            return api;
          },
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await runReseal(USER_ID);

    expect(fakeClient.rawRows("notification_queue")[0].status).toBe("sent");
  });

  it("clears legacy sync_error and notification_queue.error_message text for the user", async () => {
    fakeClient = createFakeSupabaseClient({
      external_calendars: [
        { id: "c1", user_id: USER_ID, sync_error: "stale plaintext error" },
      ],
      notification_queue: [
        {
          id: "n1",
          user_id: USER_ID,
          type: "due_date",
          status: "sent",
          payload: {},
          error_message: "stale plaintext error",
        },
      ],
    });

    await runReseal(USER_ID);

    expect(fakeClient.rawRows("external_calendars")[0].sync_error).toBeNull();
    expect(
      fakeClient.rawRows("notification_queue")[0].error_message,
    ).toBeNull();
  });

  describe("re-seal of -v1 values", () => {
    const legacy = (text: string) => encryptField(keyStoreState.key!, text);

    async function seedLegacyEveryTable() {
      const rows: Record<string, Row[]> = {
        tasks: [
          {
            id: "t1",
            user_id: USER_ID,
            content: await legacy("Buy milk"),
            description: await legacy("2%"),
            updated_at: "t0",
          },
        ],
        habits: [
          {
            id: "h1",
            user_id: USER_ID,
            name: await legacy("Run"),
            description: null,
            question: await legacy("Did you run?"),
            updated_at: "t0",
          },
        ],
        projects: [
          {
            id: "p1",
            user_id: USER_ID,
            name: await legacy("Home"),
            updated_at: "t0",
          },
        ],
        labels: [{ id: "l1", user_id: USER_ID, name: await legacy("Health") }],
        calendar_events: [
          {
            id: "e1",
            user_id: USER_ID,
            title: await legacy("Therapy"),
            description: null,
            location: null,
            category: null,
            metadata: await legacy(JSON.stringify({ a: 1 })),
            updated_at: "t0",
          },
        ],
        external_calendars: [
          {
            id: "x1",
            user_id: USER_ID,
            name: await legacy("Work"),
            username: await legacy("me"),
            updated_at: "t0",
          },
        ],
        habit_imports: [
          {
            id: "i1",
            user_id: USER_ID,
            raw: await legacy(JSON.stringify({ entries: [1] })),
            file_name: await legacy("export.db"),
          },
        ],
        habit_entries: [
          { id: "n1", habit_id: "h1", notes: await legacy("Knee fine") },
        ],
      };
      return rows;
    }

    it("turns -v1 values on every field-map table into row-bound -v2 that read back the same", async () => {
      fakeClient = createFakeSupabaseClient(await seedLegacyEveryTable());

      await runReseal(USER_ID);

      for (const [table, fields] of Object.entries(FIELD_MAP)) {
        const row = fakeClient.rawRows(table)[0];
        for (const field of fields) {
          if (row[field] === null) continue;
          expect(row[field]).toMatch(/^xchacha20poly1305-v2:/);
        }
      }
      const wrapped = wrapSupabaseClient(fakeClient, FIELD_MAP);
      const { data: task } = await wrapped.from("tasks").select().single();
      expect(task.content).toBe("Buy milk");
      const { data: event } = await wrapped
        .from("calendar_events")
        .select()
        .single();
      expect(event.metadata).toEqual({ a: 1 });
      const { data: entry } = await wrapped
        .from("habit_entries")
        .select()
        .single();
      expect(entry.notes).toBe("Knee fine");
    });

    it("after a full pass finds nothing left to upgrade", async () => {
      fakeClient = createFakeSupabaseClient(await seedLegacyEveryTable());

      await runReseal(USER_ID);

      expect(await findPendingRows(USER_ID)).toEqual([]);
    });

    it("resumes after an interruption and only rewrites the rows that remain", async () => {
      fakeClient = createFakeSupabaseClient({
        tasks: [
          {
            id: "t1",
            user_id: USER_ID,
            content: await sealed("tasks", "content", "t1", "Done already"),
            updated_at: "t0",
          },
          {
            id: "t2",
            user_id: USER_ID,
            content: await legacy("Still legacy"),
            updated_at: "t0",
          },
        ],
      });
      const finished = fakeClient.rawRows("tasks")[0].content;

      const progress: Array<{ done: number; total: number }> = [];
      await runReseal(USER_ID, (p) =>
        progress.push({ done: p.done, total: p.total }),
      );

      expect(progress.at(-1)).toEqual({ done: 1, total: 1 });
      expect(fakeClient.rawRows("tasks")[0].content).toBe(finished);
      expect(fakeClient.rawRows("tasks")[1].content).toMatch(
        /^xchacha20poly1305-v2:/,
      );
    });

    it("surfaces a concurrent edit of a -v1 row as a conflict and picks it up on retry", async () => {
      const base = createFakeSupabaseClient({
        tasks: [
          {
            id: "t1",
            user_id: USER_ID,
            content: await legacy("old"),
            updated_at: "t0",
          },
        ],
      });
      const edited = await legacy("edited elsewhere");
      fakeClient = withEditAfterRead(base, "tasks", (stored) => ({
        ...stored,
        content: edited,
        updated_at: "t1",
      }));

      await expect(runReseal(USER_ID)).rejects.toThrow(/Re-seal conflict/);
      expect(base.rawRows("tasks")[0].content).toBe(edited);

      fakeClient = base;
      await runReseal(USER_ID);
      expect(base.rawRows("tasks")[0].content).toMatch(
        /^xchacha20poly1305-v2:/,
      );
    });
  });

  describe("after a rotation", () => {
    let oldKey: Uint8Array;

    const sealedUnder = (
      key: Uint8Array,
      keyId: string,
      table: string,
      column: string,
      rowId: string,
      text: string,
    ) =>
      encryptField(key, text, { userId: USER_ID, table, column, rowId }, keyId);

    beforeEach(async () => {
      oldKey = keyStoreState.key!;
      keyStoreState.key = await generateMasterKey();
      keyStoreState.keyId = "2";
      keyStoreState.retired = { "1": oldKey };
    });

    it("re-seals rows under the retired key to the new key id and leaves nothing pending", async () => {
      fakeClient = createFakeSupabaseClient({
        tasks: [
          {
            id: "t1",
            user_id: USER_ID,
            content: await sealedUnder(
              oldKey,
              "1",
              "tasks",
              "content",
              "t1",
              "Old",
            ),
            updated_at: "t0",
          },
          {
            id: "t2",
            user_id: USER_ID,
            content: await sealedUnder(
              keyStoreState.key!,
              "2",
              "tasks",
              "content",
              "t2",
              "Already new",
            ),
            updated_at: "t0",
          },
        ],
      });
      expect(await findPendingRows(USER_ID)).toHaveLength(1);

      await runReseal(USER_ID);

      for (const row of fakeClient.rawRows("tasks")) {
        expect(row.content).toMatch(/^xchacha20poly1305-v2:2:/);
      }
      expect(await findPendingRows(USER_ID)).toEqual([]);
      const wrapped = wrapSupabaseClient(fakeClient, FIELD_MAP);
      const { data } = await wrapped
        .from("tasks")
        .select()
        .order("id")
        .limit(10);
      expect(data.map((r: Row) => r.content)).toEqual(["Old", "Already new"]);
    });

    it("finishes an unfinished -v1 upgrade in the same pass, leaving every value -v2 under the new key", async () => {
      fakeClient = createFakeSupabaseClient({
        tasks: [
          {
            id: "t1",
            user_id: USER_ID,
            content: await encryptField(oldKey, "Legacy v1"),
            updated_at: "t0",
          },
          {
            id: "t2",
            user_id: USER_ID,
            content: await sealedUnder(
              oldKey,
              "1",
              "tasks",
              "content",
              "t2",
              "v2 old key",
            ),
            updated_at: "t0",
          },
        ],
        habits: [
          {
            id: "h1",
            user_id: USER_ID,
            name: "Plain, never backfilled",
            updated_at: "t0",
          },
        ],
      });

      await runReseal(USER_ID);

      const values = [
        ...fakeClient.rawRows("tasks").map((r: Row) => r.content),
        fakeClient.rawRows("habits")[0].name,
      ];
      for (const value of values) {
        expect(value).toMatch(/^xchacha20poly1305-v2:2:/);
      }
    });

    it("fails rather than skipping a value whose key this device does not hold", async () => {
      fakeClient = createFakeSupabaseClient({
        tasks: [
          {
            id: "t1",
            user_id: USER_ID,
            content: await sealedUnder(
              oldKey,
              "9",
              "tasks",
              "content",
              "t1",
              "?",
            ),
            updated_at: "t0",
          },
        ],
      });

      await expect(runReseal(USER_ID)).rejects.toThrow(/key is unavailable/);
    });

    it("reports a corrupted -v1 value the same way instead of failing the pass", async () => {
      const valid = await encryptField(oldKey, "Legacy");
      const corrupted = `${valid.slice(0, -4)}AAAA`;
      fakeClient = createFakeSupabaseClient({
        tasks: [
          { id: "t1", user_id: USER_ID, content: corrupted, updated_at: "t0" },
        ],
      });

      expect(await runReseal(USER_ID)).toEqual([
        { table: "tasks", id: "t1", column: "content" },
      ]);
      expect(fakeClient.rawRows("tasks")[0].content).toBe(corrupted);
    });

    it("re-seals the rest and reports a value that fails to open, leaving it untouched", async () => {
      const movedFromT2 = await sealedUnder(
        oldKey,
        "1",
        "tasks",
        "content",
        "t2",
        "Not mine",
      );
      fakeClient = createFakeSupabaseClient({
        tasks: [
          {
            id: "t1",
            user_id: USER_ID,
            content: movedFromT2,
            updated_at: "t0",
          },
          {
            id: "t2",
            user_id: USER_ID,
            content: await sealedUnder(
              oldKey,
              "1",
              "tasks",
              "content",
              "t2",
              "Mine",
            ),
            updated_at: "t0",
          },
        ],
      });

      const unreadable = await runReseal(USER_ID);

      expect(unreadable).toEqual([
        { table: "tasks", id: "t1", column: "content" },
      ]);
      const [t1, t2] = fakeClient.rawRows("tasks");
      expect(t1.content).toBe(movedFromT2);
      expect(t2.content).toMatch(/^xchacha20poly1305-v2:2:/);
    });

    describe("notification queue", () => {
      const copy = (ciphertext: string) => ({
        template: 'Your task "{}" is due now.',
        ciphertext,
      });
      const queueRow = (
        id: string,
        status: string,
        ciphertext: string,
        taskId = "t1",
      ) => ({
        id,
        user_id: USER_ID,
        type: "due_date",
        status,
        payload: {
          body: "You have a task due now.",
          encrypted: copy(ciphertext),
          data: { taskId, reminderType: "due_date" },
        },
      });

      it("re-seals a pending copy under the new key, bound to its source task", async () => {
        const old = await sealedUnder(
          oldKey,
          "1",
          "tasks",
          "content",
          "t1",
          "Buy milk",
        );
        fakeClient = createFakeSupabaseClient({
          notification_queue: [queueRow("n1", "pending", old)],
        });

        await runReseal(USER_ID);

        const { encrypted } =
          fakeClient.rawRows("notification_queue")[0].payload;
        expect(encrypted.template).toBe('Your task "{}" is due now.');
        expect(encrypted.ciphertext).toMatch(/^xchacha20poly1305-v2:2:/);
        expect(
          await decryptField(keyStoreState.key!, encrypted.ciphertext, {
            userId: USER_ID,
            table: "tasks",
            column: "content",
            rowId: "t1",
          }),
        ).toBe("Buy milk");
        expect(await findPendingQueueRows(USER_ID, "2")).toEqual([]);
      });

      it("re-seals a pending habit reminder's title and question against the habit row", async () => {
        const seal = (column: string, text: string) =>
          sealedUnder(oldKey, "1", "habits", column, "h1", text);
        fakeClient = createFakeSupabaseClient({
          notification_queue: [
            {
              id: "n1",
              user_id: USER_ID,
              type: "habit_reminder",
              status: "pending",
              payload: {
                encryptedTitle: copy(await seal("name", "Run")),
                encrypted: copy(await seal("question", "Did you run?")),
                data: { habitId: "h1" },
              },
            },
          ],
        });

        await runReseal(USER_ID);

        const { payload } = fakeClient.rawRows("notification_queue")[0];
        const open = (column: string, ciphertext: string) =>
          decryptField(keyStoreState.key!, ciphertext, {
            userId: USER_ID,
            table: "habits",
            column,
            rowId: "h1",
          });
        expect(await open("name", payload.encryptedTitle.ciphertext)).toBe(
          "Run",
        );
        expect(await open("question", payload.encrypted.ciphertext)).toBe(
          "Did you run?",
        );
      });

      it("strips ciphertext from delivered and cancelled rows", async () => {
        const old = await sealedUnder(
          oldKey,
          "1",
          "tasks",
          "content",
          "t1",
          "Secret",
        );
        fakeClient = createFakeSupabaseClient({
          notification_queue: [
            queueRow("n1", "sent", old),
            queueRow("n2", "cancelled", old),
            queueRow("n3", "failed", old),
          ],
        });

        await runReseal(USER_ID);

        for (const row of fakeClient.rawRows("notification_queue")) {
          expect(row.payload.encrypted).toBeUndefined();
          expect(row.payload.body).toBe("You have a task due now.");
          expect(row.payload.data.taskId).toBe("t1");
        }
      });

      it("drops a pending copy lifted from another task instead of re-sealing it", async () => {
        const fromOtherTask = await sealedUnder(
          oldKey,
          "1",
          "tasks",
          "content",
          "t2",
          "Not mine",
        );
        fakeClient = createFakeSupabaseClient({
          notification_queue: [queueRow("n1", "pending", fromOtherTask, "t1")],
        });

        await runReseal(USER_ID);

        expect(
          fakeClient.rawRows("notification_queue")[0].payload.encrypted,
        ).toBeUndefined();
      });

      it("leaves a pending copy already under the current key alone", async () => {
        const current = await sealedUnder(
          keyStoreState.key!,
          "2",
          "tasks",
          "content",
          "t1",
          "Fresh",
        );
        fakeClient = createFakeSupabaseClient({
          notification_queue: [queueRow("n1", "pending", current)],
        });

        await runReseal(USER_ID);

        expect(
          fakeClient.rawRows("notification_queue")[0].payload.encrypted
            .ciphertext,
        ).toBe(current);
      });
    });
  });
});
