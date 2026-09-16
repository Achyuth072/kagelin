import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page, BrowserContext } from "@playwright/test";
import type { GuestData } from "@/lib/mock/mock-store";

export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY must be set (see .env.local) to run e2ee e2e specs",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface TestAccount {
  id: string;
  email: string;
  password: string;
}

let counter = 0;

export async function createConfirmedTestAccount(
  admin: SupabaseClient,
): Promise<TestAccount> {
  counter += 1;
  const email = `e2ee-test-${Date.now()}-${counter}@example.com`;
  const password = "correct horse battery staple 42";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Failed to create test account: ${error?.message}`);
  }
  return { id: data.user.id, email, password };
}

export async function deleteTestAccount(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  // FK cascades (ON DELETE CASCADE on user_id) clean up tasks/habits/etc.
  await admin.auth.admin.deleteUser(userId);
}

// Stub Turnstile to avoid slow, flaky Cloudflare round trips in headless browsers.
export async function stubTurnstile(page: Page): Promise<void> {
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js",
    async (route) => {
      await route.fulfill({
        contentType: "application/javascript",
        body: `window.turnstile = {
        render: (container, options) => {
          setTimeout(() => options.callback("stub-turnstile-token"), 0);
          return "stub-widget-id";
        },
        reset: () => {},
        remove: () => {},
      };`,
      });
    },
  );
}

export async function signInWithPasswordUI(
  page: Page,
  account: Pick<TestAccount, "email" | "password">,
): Promise<void> {
  await stubTurnstile(page);
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

// Seed storage directly; signInAsGuest() races the home-page auth guard.
export async function seedGuestData(
  context: BrowserContext,
  page: Page,
  data: GuestData,
): Promise<void> {
  await context.addCookies([
    { name: "kanso_guest_mode", value: "true", url: "http://localhost:3000/" },
  ]);
  await page.addInitScript(
    ([storageKey, json]) => {
      localStorage.setItem("kanso_guest_mode", "true");
      localStorage.setItem(storageKey, json);
    },
    ["kanso_guest_data_v11", JSON.stringify(data)],
  );
}

export function minimalGuestData(
  overrides: Partial<GuestData> = {},
): GuestData {
  const now = new Date().toISOString();
  // Suffix IDs: deriveMigrationId hashes local IDs without user scoping, which could collide across runs.
  const runId = crypto.randomUUID();
  const projectId = `guest-project-1-${runId}`;
  const habitId = `guest-habit-1-${runId}`;
  const parentTaskId = `guest-task-parent-${runId}`;
  const childTaskId = `guest-task-child-${runId}`;

  return {
    tasks: [
      {
        id: parentTaskId,
        user_id: "guest",
        project_id: projectId,
        parent_id: null,
        content: "Migration test parent task",
        description: null,
        priority: 4,
        due_date: null,
        do_date: null,
        is_evening: false,
        is_completed: false,
        completed_at: null,
        day_order: 0,
        recurrence: null,
        recurring_series_id: null,
        google_event_id: null,
        google_etag: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: childTaskId,
        user_id: "guest",
        project_id: projectId,
        parent_id: parentTaskId,
        content: "Migration test subtask",
        description: null,
        priority: 4,
        due_date: null,
        do_date: null,
        is_evening: false,
        is_completed: false,
        completed_at: null,
        day_order: 1,
        recurrence: null,
        recurring_series_id: null,
        google_event_id: null,
        google_etag: null,
        created_at: now,
        updated_at: now,
      },
    ],
    projects: [
      {
        id: projectId,
        user_id: "guest",
        name: "Migration test project",
        color: "#4B6CB7",
        view_style: "list",
        is_inbox: false,
        is_archived: false,
        created_at: now,
        updated_at: now,
      },
    ],
    habits: [
      {
        id: habitId,
        user_id: "guest",
        name: "Migration test habit",
        description: null,
        color: "#4B6CB7",
        icon: null,
        created_at: now,
        updated_at: now,
        archived_at: null,
        start_date: now.split("T")[0],
        sort_order: 0,
      },
    ],
    habit_entries: [
      {
        id: "guest-habit-entry-1",
        habit_id: habitId,
        date: now.split("T")[0],
        value: 1,
        created_at: now,
      },
    ],
    focus_logs: [],
    events: [],
    lastUpdated: now,
    ...overrides,
  };
}
