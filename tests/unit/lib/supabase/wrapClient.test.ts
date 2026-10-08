import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  wrapSupabaseClient,
  MISSING_ROW_ID_CODE,
  isContentKeyUnavailableError,
  isContentKeyRetiredError,
  onServerKeySignal,
} from "@/lib/supabase/wrapClient";
import { UNREADABLE_CONTENT_CODE } from "@/lib/crypto/unreadable";
import { FIELD_MAP, type FieldMap } from "@/lib/supabase/fieldMap";
import { generateMasterKey } from "@/lib/crypto/masterKey";
import { isCiphertext, encryptField } from "@/lib/crypto/contentCipher";
import {
  sealEnvelope,
  INITIAL_KEY_ID,
  needsReseal,
} from "@/lib/crypto/envelope";
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

const markState = { sealedV2: false };
vi.mock("@/lib/crypto/keyChainMark", () => ({
  keyChainMark: {
    load: vi.fn(async () => ({ keyId: 0, sealedV2: markState.sealedV2 })),
    raise: vi.fn(async () => {}),
  },
}));

const { trackTelemetry } = vi.hoisted(() => ({ trackTelemetry: vi.fn() }));
vi.mock("@/lib/telemetry/client", () => ({ trackTelemetry }));

beforeEach(async () => {
  trackTelemetry.mockClear();
  keyStoreState.key = await generateMasterKey();
  keyStoreState.keyId = "1";
  keyStoreState.retired = {};
  markState.sealedV2 = false;
});

describe("wrapSupabaseClient — with a populated field map", () => {
  const testFieldMap: FieldMap = { tasks: ["content", "description"] };

  it("stores an inserted row as ciphertext and reads back the plaintext", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, testFieldMap);

    const { data: inserted, error } = await client
      .from("tasks")
      .insert({ id: "t1", content: "Buy milk", priority: 1 })
      .select()
      .single();

    expect(error).toBeNull();
    expect(inserted.content).toBe("Buy milk");
    expect(inserted.priority).toBe(1);

    const stored = raw.rawRows("tasks")[0];
    expect(isCiphertext(stored.content)).toBe(true);
    expect(stored.priority).toBe(1);

    const { data: read } = await client
      .from("tasks")
      .select()
      .eq("id", stored.id)
      .maybeSingle();
    expect(read.content).toBe("Buy milk");
  });

  it("encrypts every row in an array insert", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, testFieldMap);

    const { data } = await client
      .from("tasks")
      .insert([
        { id: "t1", content: "First" },
        { id: "t2", content: "Second" },
      ])
      .select();

    expect(data.map((r: Row) => r.content)).toEqual(["First", "Second"]);
    for (const row of raw.rawRows("tasks")) {
      expect(isCiphertext(row.content)).toBe(true);
    }
  });

  it("encrypts on update and upsert", async () => {
    const raw = createFakeSupabaseClient({
      tasks: [{ id: "t1", content: "old", user_id: "u1" }],
    });
    const client = wrapSupabaseClient(raw, testFieldMap);

    await client
      .from("tasks")
      .update({ content: "new" })
      .eq("id", "t1")
      .select()
      .single();
    expect(isCiphertext(raw.rawRows("tasks")[0].content)).toBe(true);

    await client
      .from("tasks")
      .upsert({ id: "t1", content: "upserted" }, { onConflict: "id" });
    expect(isCiphertext(raw.rawRows("tasks")[0].content)).toBe(true);
  });

  it("does not double-encrypt a value that is already ciphertext", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, testFieldMap);

    const alreadyEncrypted = await encryptField(
      keyStoreState.key!,
      "already encrypted",
    );

    await client.from("tasks").insert({ id: "t1", content: alreadyEncrypted });

    expect(raw.rawRows("tasks")[0].content).toBe(alreadyEncrypted);
  });

  it("passes an untagged (plaintext) value through unchanged on read", async () => {
    const raw = createFakeSupabaseClient({
      tasks: [{ id: "t1", content: "pre-existing plaintext row" }],
    });
    const client = wrapSupabaseClient(raw, testFieldMap);

    const { data } = await client
      .from("tasks")
      .select()
      .eq("id", "t1")
      .single();
    expect(data.content).toBe("pre-existing plaintext row");
  });

  it("decrypts nested objects from an embedded select", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, {
      tasks: ["content"],
      projects: ["name"],
    });

    await client.from("projects").insert({ id: "p1", name: "Secret project" });
    await client.from("tasks").insert({ id: "t1", content: "task" });

    // Simulates PostgREST nested relation response structure.
    const rawTask = raw.rawRows("tasks").find((r: Row) => r.id === "t1");
    rawTask.projects = raw.rawRows("projects")[0];
    expect(isCiphertext(rawTask.content)).toBe(true);
    expect(isCiphertext(rawTask.projects.name)).toBe(true);

    const { data } = await client
      .from("tasks")
      .select()
      .eq("id", "t1")
      .maybeSingle();
    expect(data.content).toBe("task");
    expect(data.projects.name).toBe("Secret project");
  });

  it("leaves a table absent from the field map completely untouched", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, testFieldMap);

    const { data } = await client
      .from("profiles")
      .insert({ display_name: "Ada" })
      .select()
      .single();

    expect(data.display_name).toBe("Ada");
    expect(raw.rawRows("profiles")[0].display_name).toBe("Ada");
  });

  it("throws rather than silently writing plaintext when the key is unavailable", async () => {
    keyStoreState.key = null;
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, testFieldMap);

    await expect(
      client
        .from("tasks")
        .insert({ id: "t1", content: "should not be written" }),
    ).rejects.toThrow();
    expect(raw.rawRows("tasks")).toHaveLength(0);
  });

  it("throws rather than silently passing ciphertext through on read when the key is unavailable", async () => {
    const ciphertext = await encryptField(keyStoreState.key!, "secret");
    const raw = createFakeSupabaseClient({
      tasks: [{ id: "t1", content: ciphertext }],
    });
    const client = wrapSupabaseClient(raw, testFieldMap);
    keyStoreState.key = null;

    await expect(
      client.from("tasks").select().eq("id", "t1").single(),
    ).rejects.toThrow();
  });
});

describe("wrapSupabaseClient — with the real field map", () => {
  it("the defining test: writes a task through the wrapped client, reads it back, and the stored row is ciphertext", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    const { data: inserted } = await client
      .from("tasks")
      .insert({ id: "t1", content: "Buy milk", description: "2%", priority: 1 })
      .select()
      .single();

    expect(inserted.content).toBe("Buy milk");
    expect(inserted.description).toBe("2%");

    const stored = raw.rawRows("tasks")[0];
    expect(isCiphertext(stored.content)).toBe(true);
    expect(isCiphertext(stored.description)).toBe(true);
    expect(stored.priority).toBe(1);

    const { data: read } = await client
      .from("tasks")
      .select()
      .eq("id", stored.id)
      .maybeSingle();
    expect(read.content).toBe("Buy milk");
    expect(read.description).toBe("2%");
  });

  it("still passes a table absent from the field map through unchanged, round-tripping arrays, single(), and maybeSingle()", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    await client
      .from("focus_logs")
      .insert([{ task_id: "t1" }, { task_id: "t2" }]);
    const { data: all } = await client.from("focus_logs").select().limit(10);
    expect(all.map((r: Row) => r.task_id)).toEqual(["t1", "t2"]);
    expect(isCiphertext(raw.rawRows("focus_logs")[0].task_id)).toBe(false);

    const { data: single } = await client
      .from("focus_logs")
      .select()
      .eq("task_id", "t1")
      .single();
    expect(single.task_id).toBe("t1");

    const { data: maybe } = await client
      .from("focus_logs")
      .select()
      .eq("task_id", "missing")
      .maybeSingle();
    expect(maybe).toBeNull();
  });

  it("stores an inserted habit and project as ciphertext and reads back the plaintext", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    const { data: habit } = await client
      .from("habits")
      .insert({ id: "h1", name: "Take medication", description: "Twice daily" })
      .select()
      .single();
    expect(habit.name).toBe("Take medication");
    expect(habit.description).toBe("Twice daily");
    expect(isCiphertext(raw.rawRows("habits")[0].name)).toBe(true);
    expect(isCiphertext(raw.rawRows("habits")[0].description)).toBe(true);

    const { data: project } = await client
      .from("projects")
      .insert({ id: "p1", name: "Divorce planning" })
      .select()
      .single();
    expect(project.name).toBe("Divorce planning");
    expect(isCiphertext(raw.rawRows("projects")[0].name)).toBe(true);

    const { data: label } = await client
      .from("labels")
      .insert({ id: "l1", name: "Urgent" })
      .select()
      .single();
    expect(label.name).toBe("Urgent");
    expect(isCiphertext(raw.rawRows("labels")[0].name)).toBe(true);
  });

  it("encrypts calendar event content and the metadata JSONB, leaving times and sync identifiers readable", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    const metadata = {
      attendees: ["ada@example.com"],
      organizer: "grace@example.com",
      conference_url: "https://meet.example.com/xyz",
    };
    const { data: event } = await client
      .from("calendar_events")
      .insert({
        id: "e1",
        title: "Oncology follow-up",
        description: "Bring scan results",
        location: "St Mary's, room 4",
        category: "health",
        start_time: "2026-09-03T09:00:00Z",
        end_time: "2026-09-03T10:00:00Z",
        all_day: false,
        color: "#4B6CB7",
        recurrence_rule: "FREQ=WEEKLY",
        remote_id: "google-event-123",
        etag: 'W/"abc"',
        ics_uid: "uid-1",
        metadata,
      })
      .select()
      .single();

    expect(event.title).toBe("Oncology follow-up");
    expect(event.metadata).toEqual(metadata);

    const stored = raw.rawRows("calendar_events")[0];
    for (const field of [
      "title",
      "description",
      "location",
      "category",
      "metadata",
    ]) {
      expect(isCiphertext(stored[field])).toBe(true);
    }
    expect(stored.start_time).toBe("2026-09-03T09:00:00Z");
    expect(stored.end_time).toBe("2026-09-03T10:00:00Z");
    expect(stored.all_day).toBe(false);
    expect(stored.color).toBe("#4B6CB7");
    expect(stored.recurrence_rule).toBe("FREQ=WEEKLY");
    expect(stored.remote_id).toBe("google-event-123");
    expect(stored.etag).toBe('W/"abc"');
    expect(stored.ics_uid).toBe("uid-1");

    const { data: read } = await client
      .from("calendar_events")
      .select()
      .eq("id", stored.id)
      .maybeSingle();
    expect(read.title).toBe("Oncology follow-up");
    expect(read.description).toBe("Bring scan results");
    expect(read.location).toBe("St Mary's, room 4");
    expect(read.category).toBe("health");
    expect(read.metadata).toEqual(metadata);
  });

  it("leaves a null metadata untouched rather than encrypting the absence of one", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    await client
      .from("calendar_events")
      .update({ metadata: null, sync_state: null })
      .eq("id", "missing");

    await client
      .from("calendar_events")
      .insert({ id: "e1", title: "No metadata", metadata: null });
    expect(raw.rawRows("calendar_events")[0].metadata).toBeNull();
  });

  it("encrypts the connected-calendar name and CalDAV username, leaving provider and URLs readable", async () => {
    const raw = createFakeSupabaseClient();
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    const { data: calendar } = await client
      .from("external_calendars")
      .insert({
        id: "c1",
        provider: "caldav",
        name: "Therapy",
        username: "ada@example.com",
        server_url: "https://caldav.example.com",
        remote_calendar_id: "cal-1",
      })
      .select()
      .single();

    expect(calendar.name).toBe("Therapy");
    expect(calendar.username).toBe("ada@example.com");

    const stored = raw.rawRows("external_calendars")[0];
    expect(isCiphertext(stored.name)).toBe(true);
    expect(isCiphertext(stored.username)).toBe(true);
    expect(stored.provider).toBe("caldav");
    expect(stored.server_url).toBe("https://caldav.example.com");
    expect(stored.remote_calendar_id).toBe("cal-1");
  });

  it("passes a sync-status update through without needing the key", async () => {
    const raw = createFakeSupabaseClient({
      external_calendars: [{ id: "c1", name: "Therapy" }],
    });
    const client = wrapSupabaseClient(raw, FIELD_MAP);
    keyStoreState.key = null;

    await client
      .from("external_calendars")
      .update({ sync_status: "syncing" })
      .eq("id", "c1");

    expect(raw.rawRows("external_calendars")[0].sync_status).toBe("syncing");
  });
});

describe("wrapSupabaseClient — id-less writes", () => {
  it.each(Object.keys(FIELD_MAP))(
    "rejects an id-less insert into %s",
    async (table) => {
      const raw = createFakeSupabaseClient();
      const client = wrapSupabaseClient(raw, FIELD_MAP);

      await expect(client.from(table).insert({})).rejects.toMatchObject({
        code: "missing_row_id",
      });
      expect(raw.rawRows(table)).toEqual([]);
    },
  );

  it("rejects an id-less row anywhere in an array insert or upsert", async () => {
    const client = wrapSupabaseClient(createFakeSupabaseClient(), FIELD_MAP);

    await expect(
      client
        .from("tasks")
        .insert([{ id: "t1", content: "a" }, { content: "b" }]),
    ).rejects.toThrow(/client-generated id/);
    await expect(client.from("tasks").upsert({ content: "a" })).rejects.toThrow(
      /client-generated id/,
    );
  });

  it("does not require an id on update or on tables outside the field map", async () => {
    const raw = createFakeSupabaseClient({
      tasks: [{ id: "t1", content: "x" }],
    });
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    await client.from("tasks").update({ priority: 2 }).eq("id", "t1");
    await client.from("focus_logs").insert({ duration: 25 });

    expect(raw.rawRows("tasks")[0].priority).toBe(2);
    expect(raw.rawRows("focus_logs")).toHaveLength(1);
  });
});

describe("wrapSupabaseClient — row-bound (-v2) values", () => {
  const userId = "user-1";
  const sealV2 = (
    table: string,
    column: string,
    rowId: string,
    text: string,
    owner = userId,
  ) =>
    sealEnvelope(
      keyStoreState.key!,
      new TextEncoder().encode(text),
      INITIAL_KEY_ID,
      { userId: owner, table, column, rowId },
    );

  async function readTask(row: Row) {
    const raw = createFakeSupabaseClient({ tasks: [row] }, { userId });
    const client = wrapSupabaseClient(raw, FIELD_MAP);
    return client.from("tasks").select().eq("id", row.id).single();
  }

  it("opens a value read back in the row, column, table and account it was sealed for", async () => {
    const { data } = await readTask({
      id: "t1",
      content: await sealV2("tasks", "content", "t1", "Buy milk"),
    });

    expect(data.content).toBe("Buy milk");
  });

  it("marks a value moved to another row as unreadable instead of showing it", async () => {
    const { data } = await readTask({
      id: "t2",
      content: await sealV2("tasks", "content", "t1", "Buy milk"),
    });

    expect(data.content).toBeNull();
    expect(data.unreadable).toEqual(["content"]);
  });

  it("marks a value moved to another column as unreadable", async () => {
    const { data } = await readTask({
      id: "t1",
      content: await sealV2("tasks", "description", "t1", "Buy milk"),
    });

    expect(data.content).toBeNull();
    expect(data.unreadable).toEqual(["content"]);
  });

  it("marks a value moved to another table as unreadable", async () => {
    const { data } = await readTask({
      id: "t1",
      content: await sealV2("habits", "content", "t1", "Buy milk"),
    });

    expect(data.content).toBeNull();
    expect(data.unreadable).toEqual(["content"]);
  });

  it("marks a value from another account as unreadable", async () => {
    const { data } = await readTask({
      id: "t1",
      content: await sealV2("tasks", "content", "t1", "Buy milk", "user-2"),
    });

    expect(data.content).toBeNull();
    expect(data.unreadable).toEqual(["content"]);
  });

  it("fails closed when there is no session to supply the user id", async () => {
    const raw = createFakeSupabaseClient(
      {
        tasks: [
          {
            id: "t1",
            content: await sealV2("tasks", "content", "t1", "Buy milk"),
          },
        ],
      },
      { userId: null },
    );
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    await expect(client.from("tasks").select().single()).rejects.toThrow(
      /binding/,
    );
  });

  it("still reads -v1 values with no binding and no session", async () => {
    const raw = createFakeSupabaseClient(
      {
        tasks: [
          { id: "t1", content: await encryptField(keyStoreState.key!, "old") },
        ],
      },
      { userId: null },
    );
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    const { data } = await client.from("tasks").select().single();
    expect(data.content).toBe("old");
  });
});

describe("wrapSupabaseClient — sealing writes row-bound", () => {
  const userId = "user-1";
  const writes: Record<string, Row> = {
    tasks: { id: "r1", content: "Buy milk", description: "2%" },
    habits: { id: "r1", name: "Run", description: "Daily", question: "Ran?" },
    projects: { id: "r1", name: "Home" },
    labels: { id: "r1", name: "Health" },
    calendar_events: {
      id: "r1",
      title: "Therapy",
      description: "d",
      location: "l",
      category: "c",
      metadata: { a: 1 },
    },
    external_calendars: { id: "r1", name: "Work", username: "me" },
    habit_imports: { id: "r1", raw: { entries: [1] }, file_name: "x.db" },
    habit_entries: { id: "r1", notes: "Knee fine" },
  };

  it.each(Object.entries(writes))(
    "writes %s as -v2 and reads it back",
    async (table, row) => {
      const raw = createFakeSupabaseClient({}, { userId });
      const client = wrapSupabaseClient(raw, FIELD_MAP);

      await client.from(table).insert(row);

      const stored = raw.rawRows(table)[0];
      for (const field of FIELD_MAP[table]) {
        expect(stored[field]).toMatch(/^xchacha20poly1305-v2:/);
      }
      const { data } = await client.from(table).select().single();
      for (const field of FIELD_MAP[table]) {
        expect(data[field]).toEqual(row[field]);
      }
    },
  );

  it("still reads a legacy -v1 row", async () => {
    const raw = createFakeSupabaseClient(
      {
        tasks: [
          { id: "t1", content: await encryptField(keyStoreState.key!, "old") },
        ],
      },
      { userId },
    );
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    const { data } = await client.from("tasks").select().single();

    expect(data.content).toBe("old");
  });

  it("binds an update to the row named by its id filter", async () => {
    const raw = createFakeSupabaseClient(
      {
        tasks: [
          { id: "t1", content: "a" },
          { id: "t2", content: "b" },
        ],
      },
      { userId },
    );
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    await client.from("tasks").update({ content: "edited" }).eq("id", "t2");

    const rows = raw.rawRows("tasks");
    const { data } = await client
      .from("tasks")
      .select()
      .eq("id", "t2")
      .single();
    expect(data.content).toBe("edited");
    rows[0].content = rows[1].content;
    const { data: moved } = await client
      .from("tasks")
      .select()
      .eq("id", "t1")
      .single();
    expect(moved.content).toBeNull();
    expect(moved.unreadable).toEqual(["content"]);
  });

  it("rejects an update of a sealed column that names no row id", async () => {
    const raw = createFakeSupabaseClient(
      { tasks: [{ id: "t1", content: "a" }] },
      { userId },
    );
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    await expect(
      client.from("tasks").update({ content: "edited" }).eq("priority", 1),
    ).rejects.toMatchObject({ code: MISSING_ROW_ID_CODE });
    expect(raw.rawRows("tasks")[0].content).toBe("a");
  });

  it("lets an update that touches no sealed column go without a row id", async () => {
    const raw = createFakeSupabaseClient(
      { tasks: [{ id: "t1", content: "a", priority: 1 }] },
      { userId },
    );
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    await client.from("tasks").update({ priority: 2 }).eq("priority", 1);

    expect(raw.rawRows("tasks")[0].priority).toBe(2);
  });

  it.each([
    ["another row", "tasks", { id: "t2", content: "SEALED" }, userId],
    ["another column", "tasks", { id: "t1", description: "SEALED" }, userId],
    ["another table", "projects", { id: "t1", name: "SEALED" }, userId],
    ["another account", "tasks", { id: "t1", content: "SEALED" }, "user-2"],
  ])(
    "marks a value moved to %s as unreadable and keeps the row",
    async (_place, table, row, reader) => {
      const source = createFakeSupabaseClient({}, { userId });
      await wrapSupabaseClient(source, FIELD_MAP)
        .from("tasks")
        .insert({ id: "t1", content: "secret" });
      const sealedContent = source.rawRows("tasks")[0].content;
      const moved = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k,
          v === "SEALED" ? sealedContent : v,
        ]),
      );

      const raw = createFakeSupabaseClient(
        { [table]: [moved] },
        { userId: reader },
      );
      const { data } = await wrapSupabaseClient(raw, FIELD_MAP)
        .from(table)
        .select()
        .single();

      const [field] = Object.entries(row).find(([, v]) => v === "SEALED")!;
      expect(data.id).toBe(row.id);
      expect(data[field]).toBeNull();
      expect(data.unreadable).toEqual([field]);
    },
  );

  it("throws the server's old-scheme rejection as an update-the-app error", async () => {
    const raw = createFakeSupabaseClient(
      {},
      {
        userId,
        failWrite: () => ({
          code: "23514",
          message:
            "Column tasks.content must be sealed with the current scheme",
          hint: "sealing_scheme_outdated",
        }),
      },
    );
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    const error = await client
      .from("tasks")
      .insert({ id: "t1", content: "x" })
      .then(
        () => null,
        (e: unknown) => e,
      );

    // Thrown like a locked key, so call sites that rethrow only error.message keep the code.
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      code: "app_update_required",
      message: "Kagelin has been updated. Reload the app to keep saving.",
    });
  });
});

describe("wrapSupabaseClient — during a rotation's Re-seal", () => {
  const userId = "user-1";
  const seal = (key: Uint8Array, keyId: string, rowId: string, text: string) =>
    encryptField(
      key,
      text,
      { userId, table: "tasks", column: "content", rowId },
      keyId,
    );

  async function rotatedClient(rows: (oldKey: Uint8Array) => Promise<Row[]>) {
    const oldKey = keyStoreState.key!;
    const newKey = await generateMasterKey();
    const seeded = await rows(oldKey);
    keyStoreState.key = newKey;
    keyStoreState.keyId = "2";
    keyStoreState.retired = { "1": oldKey };
    const raw = createFakeSupabaseClient({ tasks: seeded }, { userId });
    return { raw, client: wrapSupabaseClient(raw, FIELD_MAP), newKey };
  }

  it("reads rows under the retired key and rows under the current key in one query", async () => {
    const { client } = await rotatedClient(async (oldKey) => [
      { id: "t1", content: await seal(oldKey, "1", "t1", "Sealed before") },
    ]);
    await client
      .from("tasks")
      .insert({ id: "t2", content: "Written after" })
      .select()
      .single();

    const { data } = await client.from("tasks").select().order("id").limit(10);

    expect(data.map((r: Row) => r.content)).toEqual([
      "Sealed before",
      "Written after",
    ]);
  });

  it("writes under the current key id", async () => {
    const { raw } = await rotatedClient(async () => []);
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    await client.from("tasks").insert({ id: "t9", content: "New" });

    expect(raw.rawRows("tasks")[0].content).toMatch(/^xchacha20poly1305-v2:2:/);
  });

  it("asks to unlock again for a value under a key this device does not hold", async () => {
    const { client } = await rotatedClient(async (oldKey) => [
      { id: "t1", content: await seal(oldKey, "7", "t1", "From a later key") },
    ]);

    await expect(client.from("tasks").select().single()).rejects.toMatchObject({
      code: "content_key_unavailable",
    });
  });

  it("throws the server's retired-key rejection as the unlock-again error", async () => {
    const raw = createFakeSupabaseClient(
      {},
      {
        userId,
        failWrite: () => ({
          message: "must be sealed with the current content key",
          hint: "content_key_retired",
        }),
      },
    );
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    await expect(
      client.from("tasks").insert({ id: "t1", content: "Stale write" }),
    ).rejects.toSatisfy(isContentKeyUnavailableError);
  });

  it("tells the server's retired-key rejection apart from a missing local key", async () => {
    const retired = createFakeSupabaseClient(
      {},
      {
        userId,
        failWrite: () => ({
          message: "must be sealed with the current content key",
          hint: "content_key_retired",
        }),
      },
    );
    const retiredError = await wrapSupabaseClient(retired, FIELD_MAP)
      .from("tasks")
      .insert({ id: "t1", content: "Stale write" })
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(isContentKeyRetiredError(retiredError)).toBe(true);

    keyStoreState.key = null;
    const noKeyError = await wrapSupabaseClient(
      createFakeSupabaseClient({}, { userId }),
      FIELD_MAP,
    )
      .from("tasks")
      .insert({ id: "t2", content: "No key" })
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(isContentKeyUnavailableError(noKeyError)).toBe(true);
    expect(isContentKeyRetiredError(noKeyError)).toBe(false);
  });
});

describe("onServerKeySignal", () => {
  const userId = "user-1";
  const rejectWith = (hint?: string) =>
    wrapSupabaseClient(
      createFakeSupabaseClient(
        {},
        { userId, failWrite: () => ({ message: "rejected", hint }) },
      ),
      FIELD_MAP,
    )
      .from("tasks")
      .insert({ id: "t1", content: "x" })
      .then(
        () => null,
        (e: unknown) => e,
      );

  it("announces a server key rejection once, with the hint that caused it", async () => {
    const listener = vi.fn();
    const off = onServerKeySignal(listener);

    await rejectWith("content_key_retired");
    await rejectWith("sealing_scheme_outdated");
    off();

    expect(listener.mock.calls).toEqual([
      ["content_key_retired"],
      ["app_update_required"],
    ]);
  });

  it("stays silent for other failures and after unsubscribing", async () => {
    const listener = vi.fn();
    const off = onServerKeySignal(listener);

    await rejectWith(undefined);
    off();
    await rejectWith("content_key_retired");

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("wrapSupabaseClient — unreadable values", () => {
  const userId = "user-1";
  const sealFor = (
    table: string,
    column: string,
    rowId: string,
    text: string,
  ) =>
    sealEnvelope(
      keyStoreState.key!,
      new TextEncoder().encode(text),
      INITIAL_KEY_ID,
      { userId, table, column, rowId },
    );

  it("keeps the rest of a list readable when one value was moved", async () => {
    const raw = createFakeSupabaseClient(
      {
        tasks: [
          { id: "t1", content: await sealFor("tasks", "content", "t1", "One") },
          { id: "t2", content: await sealFor("tasks", "content", "t1", "One") },
          {
            id: "t3",
            content: await sealFor("tasks", "content", "t3", "Three"),
          },
        ],
      },
      { userId },
    );

    const { data, error } = await wrapSupabaseClient(raw, FIELD_MAP)
      .from("tasks")
      .select()
      .order("id")
      .limit(10);

    expect(error).toBeNull();
    expect(data.map((t: Row) => t.content)).toEqual(["One", null, "Three"]);
    expect(data[0].unreadable).toBeUndefined();
    expect(data[1].unreadable).toEqual(["content"]);
  });

  it("marks an unreadable value inside an embedded row", async () => {
    const project = {
      id: "p1",
      name: await sealFor("projects", "name", "p9", "Moved"),
    };
    const raw = createFakeSupabaseClient(
      {
        tasks: [
          {
            id: "t1",
            content: await sealFor("tasks", "content", "t1", "Task"),
            projects: project,
          },
        ],
      },
      { userId },
    );

    const { data } = await wrapSupabaseClient(raw, FIELD_MAP)
      .from("tasks")
      .select()
      .single();

    expect(data.content).toBe("Task");
    expect(data.unreadable).toBeUndefined();
    expect(data.projects.name).toBeNull();
    expect(data.projects.unreadable).toEqual(["name"]);
  });

  it("marks a malformed envelope and a JSON field that does not parse", async () => {
    const raw = createFakeSupabaseClient(
      {
        calendar_events: [
          {
            id: "e1",
            title: "xchacha20poly1305-v2:1:broken",
            description: "xchacha20poly1305-v2::nonce:ciphertext",
            metadata: await sealFor(
              "calendar_events",
              "metadata",
              "e1",
              "{not json",
            ),
            location: await sealFor(
              "calendar_events",
              "location",
              "e1",
              "Room 4",
            ),
          },
        ],
      },
      { userId },
    );

    const { data } = await wrapSupabaseClient(raw, FIELD_MAP)
      .from("calendar_events")
      .select()
      .single();

    expect(data.title).toBeNull();
    expect(data.metadata).toBeNull();
    expect(data.location).toBe("Room 4");
    expect(data.description).toBeNull();
    expect(data.unreadable).toEqual(["title", "description", "metadata"]);
  });

  it("reports each unreadable value once, with no row id", async () => {
    const raw = createFakeSupabaseClient(
      {
        habits: [
          {
            id: "h-once",
            name: await sealFor("habits", "name", "h-other", "Run"),
          },
        ],
      },
      { userId },
    );
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    await client.from("habits").select().limit(10);
    await client.from("habits").select().limit(10);

    expect(trackTelemetry).toHaveBeenCalledTimes(1);
    expect(trackTelemetry).toHaveBeenCalledWith("content_unreadable", {
      table: "habits",
      column: "name",
    });
  });

  it.each(["insert", "upsert", "update"] as const)(
    "refuses to %s a row that carries the unreadable marker",
    async (method) => {
      const raw = createFakeSupabaseClient(
        { tasks: [{ id: "t1", content: "old" }] },
        { userId },
      );
      const row = { id: "t1", content: null, unreadable: ["content"] };

      const query = wrapSupabaseClient(raw, FIELD_MAP).from("tasks");
      const write =
        method === "update"
          ? query.update(row).eq("id", "t1")
          : query[method](row);

      await expect(write).rejects.toMatchObject({
        code: UNREADABLE_CONTENT_CODE,
      });
      expect(raw.rawRows("tasks")[0].content).toBe("old");
    },
  );

  it("saves a new value over an unreadable one when only the edited field is sent", async () => {
    const raw = createFakeSupabaseClient(
      {
        tasks: [
          {
            id: "t1",
            content: await sealFor("tasks", "content", "t9", "Moved"),
          },
        ],
      },
      { userId },
    );
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    await client.from("tasks").update({ content: "Fixed" }).eq("id", "t1");
    const { data } = await client.from("tasks").select().single();

    expect(data.content).toBe("Fixed");
    expect(data.unreadable).toBeUndefined();
    expect(needsReseal(raw.rawRows("tasks")[0].content, "1")).toBe(false);
  });
});

describe("wrapSupabaseClient — after this device has seen a finished Re-seal", () => {
  const userId = "user-1";

  beforeEach(() => {
    markState.sealedV2 = true;
  });

  it("shows a -v1 value as unreadable instead of opening it unbound", async () => {
    const raw = createFakeSupabaseClient(
      {
        tasks: [
          {
            id: "t1",
            content: await encryptField(keyStoreState.key!, "moved"),
          },
        ],
      },
      { userId },
    );
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    const { data } = await client.from("tasks").select().single();

    expect(data.content).toBeNull();
    expect(data.unreadable).toEqual(["content"]);
  });

  it("shows a plaintext value as unreadable", async () => {
    const raw = createFakeSupabaseClient(
      { calendar_events: [{ id: "e1", title: "Planted", metadata: { a: 1 } }] },
      { userId },
    );
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    const { data } = await client.from("calendar_events").select().single();

    expect(data.title).toBeNull();
    expect(data.metadata).toBeNull();
    expect(data.unreadable).toEqual(["title", "metadata"]);
  });

  it("still reads -v2 values and leaves empty columns alone", async () => {
    const raw = createFakeSupabaseClient({}, { userId });
    const client = wrapSupabaseClient(raw, FIELD_MAP);
    await client
      .from("tasks")
      .insert({ id: "t1", content: "Buy milk", description: null });

    const { data } = await client.from("tasks").select().single();

    expect(data.content).toBe("Buy milk");
    expect(data.description).toBeNull();
    expect(data.unreadable).toBeUndefined();
  });

  it("reads a decrypted JSON value verbatim, not as nested rows", async () => {
    const raw = createFakeSupabaseClient({}, { userId });
    const client = wrapSupabaseClient(raw, FIELD_MAP);
    const blob = { habits: [{ name: "Run" }], tasks: [{ content: "x" }] };
    await client
      .from("habit_imports")
      .insert({ id: "i1", raw: blob, file_name: "loop.db" });

    const { data } = await client.from("habit_imports").select().single();

    expect(data.raw).toEqual(blob);
    expect(data.unreadable).toBeUndefined();
  });

  it("still reads plaintext for a signed-out guest", async () => {
    const raw = createFakeSupabaseClient(
      { tasks: [{ id: "t1", content: "Guest task" }] },
      { userId: null },
    );
    const client = wrapSupabaseClient(raw, FIELD_MAP);

    const { data } = await client.from("tasks").select().single();

    expect(data.content).toBe("Guest task");
  });
});
