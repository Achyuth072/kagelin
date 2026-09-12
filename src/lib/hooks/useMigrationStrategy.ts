import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { notify } from "@/lib/notify";
import { trackSignupCompleted } from "@/lib/telemetry/client";
import { deriveMigrationId } from "@/lib/migration/deterministicId";
import { migrationSnapshot } from "@/lib/migration/snapshot";
import { migrationIntent } from "@/lib/migration/intent";
import { createBackupZip, downloadBackup } from "@/lib/backup/export-import";
import type { BackupMetadata } from "@/lib/backup/types";
import {
  STORAGE_KEY as GUEST_DATA_STORAGE_KEY,
  stripDemoData,
  type GuestData,
} from "@/lib/mock/mock-store";
import pkg from "../../../package.json";

// Stuck-retry UI threshold only; never gates step execution.
const FAILURE_COUNT_KEY = "kanso_migration_failure_count";
const STUCK_AFTER_FAILURES = 2;

function hasRealContent(data: GuestData): boolean {
  return (
    (data.tasks?.length ?? 0) > 0 ||
    (data.habits?.length ?? 0) > 0 ||
    (data.projects?.length ?? 0) > 0 ||
    (data.events?.length ?? 0) > 0 ||
    (data.habit_entries?.length ?? 0) > 0 ||
    (data.focus_logs?.length ?? 0) > 0
  );
}

function getFailureCount(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(FAILURE_COUNT_KEY) ?? "0");
}

// Deterministic IDs and ignoreDuplicates make row inserts idempotent across retries.
async function upsertRows(
  supabase: ReturnType<typeof createClient>,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
}

export function useMigrationStrategy() {
  const { user, isGuestMode } = useAuth();
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStuck, setMigrationStuck] = useState(
    () => getFailureCount() >= STUCK_AFTER_FAILURES,
  );
  const migrationInProgress = useRef(false);
  // Stable identity across renders so the migrate() effect below doesn't re-run.
  const [supabase] = useState(() => createClient());

  const migrate = useCallback(async () => {
    if (
      !user ||
      user.id === "guest" ||
      isGuestMode ||
      migrationInProgress.current
    ) {
      return;
    }

    // Only migrate if this account initiated the guest session transition.
    if (!migrationIntent.isFor(user.id)) {
      return;
    }

    const guestDataStr = localStorage.getItem(GUEST_DATA_STORAGE_KEY);

    if (!guestDataStr) {
      return;
    }

    migrationInProgress.current = true;

    try {
      setIsMigrating(true);

      let guestData = await migrationSnapshot.load(user.id);

      if (guestData === null) {
        // Prevents fabricated history from becoming the user's real streaks/scores. See ADR 0014.
        const liveGuestData = stripDemoData(
          JSON.parse(guestDataStr) as GuestData,
        );

        // Avoid reload loop: mock-store re-seeds demo data on every load.
        if (!hasRealContent(liveGuestData)) {
          migrationIntent.clear();
          localStorage.removeItem("kanso_guest_mode");
          localStorage.removeItem(FAILURE_COUNT_KEY);
          document.cookie = "kanso_guest_mode=; path=/; max-age=0";
          return;
        }

        // eslint-disable-next-line local/no-unbounded-supabase-select -- project definitions, not tasks
        const { data: userProjects } = await supabase
          .from("projects")
          .select("id, name, is_inbox")
          .eq("user_id", user.id);

        // Demo projects are stripped above, so project count alone can't signal an established account.
        const hasManualProject =
          userProjects?.some((p) => !p.is_inbox) ?? false;

        const [{ count: existingTaskCount }, { count: existingHabitCount }] =
          await Promise.all([
            supabase
              .from("tasks")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id),
            supabase
              .from("habits")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id),
          ]);

        const hasExistingContent =
          hasManualProject ||
          (existingTaskCount ?? 0) > 0 ||
          (existingHabitCount ?? 0) > 0;

        if (hasExistingContent) {
          migrationIntent.clear();
          localStorage.removeItem("kanso_guest_mode");
          localStorage.removeItem(GUEST_DATA_STORAGE_KEY);
          localStorage.removeItem(FAILURE_COUNT_KEY);
          document.cookie = "kanso_guest_mode=; path=/; max-age=0";
          setIsMigrating(false);
          return;
        }

        // Snapshot before server writes so retries are isolated from live storage mutations.
        await migrationSnapshot.save(user.id, liveGuestData);
        guestData = liveGuestData;
      }

      const projectIdMap = new Map<string, string>();
      const habitIdMap = new Map<string, string>();
      const taskIdMap = new Map<string, string>();

      const [{ data: existingInbox }, { data: existingHabits }] =
        await Promise.all([
          guestData.projects && guestData.projects.length > 0
            ? supabase
                .from("projects")
                .select("id")
                .eq("user_id", user.id)
                .eq("is_inbox", true)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          // Reuse same-named habits if already present on the account.
          guestData.habits && guestData.habits.length > 0
            ? // eslint-disable-next-line local/no-unbounded-supabase-select -- habit definitions, not entries
              supabase.from("habits").select("id, name").eq("user_id", user.id)
            : Promise.resolve({ data: null }),
        ]);

      if (guestData.projects && guestData.projects.length > 0) {
        const rows = await Promise.all(
          guestData.projects.map(async (project) => {
            const id =
              project.is_inbox && existingInbox?.id
                ? existingInbox.id
                : await deriveMigrationId(`project:${project.id}`);
            projectIdMap.set(project.id, id);
            return {
              id,
              user_id: user.id,
              name: project.name,
              color: project.color,
              view_style: project.view_style,
              is_inbox: project.is_inbox,
              is_archived: project.is_archived,
              created_at: project.created_at,
              updated_at: project.updated_at,
            };
          }),
        );
        await upsertRows(supabase, "projects", rows);
      }

      if (guestData.habits && guestData.habits.length > 0) {
        const rows = await Promise.all(
          guestData.habits.map(async (habit) => {
            const existing = existingHabits?.find((h) => h.name === habit.name);
            const id =
              existing?.id ?? (await deriveMigrationId(`habit:${habit.id}`));
            habitIdMap.set(habit.id, id);
            return {
              id,
              user_id: user.id,
              name: habit.name,
              description: habit.description,
              color: habit.color,
              icon: habit.icon,
              start_date: habit.start_date,
              created_at: habit.created_at,
              updated_at: habit.updated_at,
              archived_at: habit.archived_at,
            };
          }),
        );
        await upsertRows(supabase, "habits", rows);
      }

      if (guestData.tasks && guestData.tasks.length > 0) {
        const rows = await Promise.all(
          guestData.tasks.map(async (t) => {
            const id = await deriveMigrationId(`task:${t.id}`);
            taskIdMap.set(t.id, id);
            return {
              id,
              user_id: user.id,
              project_id: t.project_id
                ? (projectIdMap.get(t.project_id) ??
                  (await deriveMigrationId(`project:${t.project_id}`)))
                : null,
              content: t.content,
              description: t.description,
              priority: t.priority,
              due_date: t.due_date,
              do_date: t.do_date,
              is_evening: t.is_evening,
              is_completed: t.is_completed,
              completed_at: t.completed_at,
              day_order: t.day_order,
              recurrence: t.recurrence,
              google_event_id: t.google_event_id,
              google_etag: t.google_etag,
              created_at: t.created_at,
              updated_at: t.updated_at,
            };
          }),
        );
        await upsertRows(supabase, "tasks", rows);

        // Link subtasks after parent rows exist to satisfy FK constraints.
        const subtasks = guestData.tasks.filter((t) => t.parent_id !== null);
        await Promise.all(
          subtasks.map(async (st) => {
            if (!st.parent_id) return;
            const newTaskId =
              taskIdMap.get(st.id) ??
              (await deriveMigrationId(`task:${st.id}`));
            const newParentId =
              taskIdMap.get(st.parent_id) ??
              (await deriveMigrationId(`task:${st.parent_id}`));
            await supabase
              .from("tasks")
              .update({ parent_id: newParentId })
              .eq("id", newTaskId);
          }),
        );
      }

      if (guestData.habit_entries && guestData.habit_entries.length > 0) {
        const rows = await Promise.all(
          guestData.habit_entries.map(async (e) => {
            const habitId =
              habitIdMap.get(e.habit_id) ??
              (await deriveMigrationId(`habit:${e.habit_id}`));
            return {
              // Keyed on habitId and date to satisfy UNIQUE(habit_id, date).
              id: await deriveMigrationId(`habit-entry:${habitId}:${e.date}`),
              habit_id: habitId,
              date: e.date,
              value: e.value,
              created_at: e.created_at,
            };
          }),
        );
        await upsertRows(supabase, "habit_entries", rows);
      }

      if (guestData.events && guestData.events.length > 0) {
        // Skip synced external events to prevent FK violations with guest-local
        // calendar IDs; they are re-synced when the user reconnects the calendar.
        const rows = await Promise.all(
          guestData.events
            .filter((e) => !e.remote_calendar_id)
            .map(async (e) => ({
              id: await deriveMigrationId(`event:${e.id}`),
              user_id: user.id,
              title: e.title,
              description: e.description,
              location: e.location,
              start_time: e.start_time,
              end_time: e.end_time,
              all_day: e.all_day,
              color: e.color,
              category: e.category,
              recurrence_rule: e.recurrence_rule,
              metadata: e.metadata,
              is_archived: e.is_archived,
              created_at: e.created_at,
              updated_at: e.updated_at,
            })),
        );
        await upsertRows(supabase, "calendar_events", rows);
      }

      if (guestData.focus_logs && guestData.focus_logs.length > 0) {
        const rows = await Promise.all(
          guestData.focus_logs.map(async (l) => ({
            id: await deriveMigrationId(`focus-log:${l.id}`),
            user_id: user.id,
            task_id: l.task_id
              ? (taskIdMap.get(l.task_id) ??
                (await deriveMigrationId(`task:${l.task_id}`)))
              : null,
            start_time: l.start_time,
            end_time: l.end_time,
            duration_seconds: l.duration_seconds,
            created_at: l.created_at,
          })),
        );
        await upsertRows(supabase, "focus_logs", rows);
      }

      await migrationSnapshot.clear();
      migrationIntent.clear();
      localStorage.removeItem("kanso_guest_mode");
      localStorage.removeItem(GUEST_DATA_STORAGE_KEY);
      localStorage.removeItem(FAILURE_COUNT_KEY);
      document.cookie = "kanso_guest_mode=; path=/; max-age=0";
      setMigrationStuck(false);

      notify.success(
        "Synchronization complete! Your data is safe in the cloud. Demo content wasn't carried over.",
      );

      trackSignupCompleted();

      window.location.reload();
    } catch (err: unknown) {
      console.error("Migration fatal error:", err);
      const failures = getFailureCount() + 1;
      localStorage.setItem(FAILURE_COUNT_KEY, String(failures));
      if (failures >= STUCK_AFTER_FAILURES) {
        setMigrationStuck(true);
        notify.error(
          "We're having trouble syncing your data. You can export a backup below while we keep retrying.",
        );
      } else {
        notify.error(
          "Sync interrupted. We'll try again automatically on next reload.",
        );
      }
    } finally {
      setIsMigrating(false);
      migrationInProgress.current = false;
    }
  }, [user, isGuestMode, supabase]);

  const exportSnapshot = useCallback(async () => {
    if (!user) return;
    const snapshot = await migrationSnapshot.load(user.id);
    if (!snapshot) {
      notify.error("No backup available to export.");
      return;
    }

    const metadata: BackupMetadata = {
      version: 1,
      appVersion: pkg.version,
      exportedAt: new Date().toISOString(),
    };

    const blob = await createBackupZip({
      metadata,
      tasks: snapshot.tasks ?? [],
      projects: snapshot.projects ?? [],
      habits: snapshot.habits ?? [],
      habit_entries: snapshot.habit_entries ?? [],
      focus_logs: snapshot.focus_logs ?? [],
      events: snapshot.events ?? [],
    });
    downloadBackup(
      blob,
      `kanso-guest-backup-${new Date().toISOString().split("T")[0]}.zip`,
    );
  }, [user]);

  useEffect(() => {
    const hasGuestData = localStorage.getItem(GUEST_DATA_STORAGE_KEY) !== null;
    if (user && user.id !== "guest" && !isGuestMode && hasGuestData) {
      migrate();
    }
  }, [user, isGuestMode, migrate]);

  return { isMigrating, migrationStuck, exportSnapshot };
}
