import { isWeekend } from "date-fns";
import * as Sentry from "@sentry/nextjs";
import type { Task, Project } from "@/lib/types/task";
import {
  ENTRY_VALUE_DONE,
  ENTRY_VALUE_SKIPPED,
  REMINDER_EVERY_DAY,
  type Habit,
  type HabitEntry,
} from "@/lib/types/habit";
import type { FocusLog } from "@/lib/types/focus";
import type { CalendarEvent } from "@/lib/types/calendar-event";
import type { BackupData } from "@/lib/backup/types";
import { MEET_KAGELIN_PROJECT, meetKagelinSteps } from "@/lib/meet-kagelin";
import { periodForFrequencyDays } from "@/lib/utils/habit-frequency";

export const STORAGE_KEY = "kanso_guest_data_v11";
export const DEMO_TUTORIAL_PROJECT_ID = "demo-project-meet-kagelin";

export interface GuestData {
  tasks: Task[];
  projects: Project[];
  habits: Habit[];
  habit_entries: HabitEntry[];
  focus_logs: FocusLog[];
  events: CalendarEvent[];
  lastUpdated: string;
  // Optional so guest sessions persisted before this field existed still deserialize.
  seed_ids?: string[];
}

type BackupPayload = Omit<BackupData, "metadata">;

// Mulberry32 PRNG for deterministic test seeding.
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class MockStore {
  private data: GuestData;

  constructor() {
    const stored = this.loadFromStorage();
    if (stored) {
      this.data = stored;
    } else {
      this.data = this.getInitialData();
      this.saveToStorage();
    }
  }

  private getInitialData(rng: () => number = Math.random): GuestData {
    const now = new Date();
    const nowIso = now.toISOString();
    const oneDay = 86400000;
    const startOfHistory = new Date(now.getTime() - 365 * oneDay)
      .toISOString()
      .split("T")[0];

    const pWork = "demo-project-work";
    const pPersonal = "demo-project-personal";
    const pSide = "demo-project-side";

    const projects: Project[] = [
      {
        id: DEMO_TUTORIAL_PROJECT_ID,
        user_id: "guest",
        ...MEET_KAGELIN_PROJECT,
        view_style: "list",
        is_inbox: false,
        is_archived: false,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: pWork,
        user_id: "guest",
        name: "Work",
        color: "#4B6CB7",
        view_style: "list",
        is_inbox: false,
        is_archived: false,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: pPersonal,
        user_id: "guest",
        name: "Personal",
        color: "#839B82",
        view_style: "list",
        is_inbox: false,
        is_archived: false,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: pSide,
        user_id: "guest",
        name: "Home",
        color: "#8B6B80",
        view_style: "board",
        is_inbox: false,
        is_archived: false,
        created_at: nowIso,
        updated_at: nowIso,
      },
    ];

    const tasks: Task[] = [];
    const logs: FocusLog[] = [];
    const habits: Habit[] = [];
    const entries: HabitEntry[] = [];
    const events: CalendarEvent[] = [];

    const generateId = () => rng().toString(36).substr(2, 9);
    const pick = <T>(options: readonly T[]) =>
      options[Math.floor(rng() * options.length)];
    const dayAt = (dayOffset: number) =>
      new Date(now.getTime() + dayOffset * oneDay);
    const randomPriority = (min: 1 | 2 | 3, max: 3 | 4) =>
      (min + Math.floor(rng() * (max - min + 1))) as 1 | 2 | 3 | 4;

    const deepWork = [
      "Finish the quarterly report",
      "Prepare the client deck",
      "Write the project brief",
      "Review the budget",
      "Draft the proposal",
      "Update the roadmap",
      "Plan the team offsite",
      "Clear the inbox",
    ] as const;

    const collabWork = [
      "Team meeting",
      "Reply to client emails",
      "Review a colleague's draft",
      "Weekly check-in",
      "Call the supplier",
      "Send the invoice",
      "Interview a candidate",
      "Share meeting notes",
    ] as const;

    const eveningLife = [
      "Cook dinner",
      "Pay the electricity bill",
      "Call Mum",
      "Read a chapter",
      "Plan the weekend",
      "Water the plants",
      "Do the laundry",
      "Book a haircut",
      "Order a birthday gift",
      "Watch a film",
    ] as const;

    const weekendLife = [
      "Grocery shopping",
      "Clean the flat",
      "Brunch with friends",
      "Long walk in the park",
      "Farmers market run",
      "Fix the bike",
      "Family video call",
      "Meal prep for the week",
    ] as const;

    const createTask = (
      content: string,
      dayOffset: number,
      projectId: string | null,
      options: {
        priority?: 1 | 2 | 3 | 4;
        isEvening?: boolean;
        parentId?: string | null;
        completionRate?: number;
        description?: string;
        hour?: number;
        // Finished demo work is undated so the Calendar shows only the
        // tutorial and events; Stats reads completed_at instead.
        dateField?: "due_date" | "do_date" | null;
      } = {},
    ): string | null => {
      const {
        priority = 4,
        isEvening = false,
        parentId = null,
        completionRate = 0,
        description = null,
        hour,
        dateField = null,
      } = options;
      const date = dayAt(dayOffset);

      if (hour !== undefined) {
        date.setHours(hour, 0, 0, 0);
      } else {
        const randomHour = isEvening ? 18 + rng() * 4 : 8 + rng() * 6;
        const randomMinute = Math.floor(rng() * 60);
        date.setHours(Math.floor(randomHour), randomMinute, 0, 0);
      }

      const dueDate = date.toISOString();
      const isPast = dayOffset < 0;
      const isCompleted = isPast && rng() < completionRate;

      const taskId = `task-${generateId()}`;

      // Open demo work would bury the Meet Kagelin steps on Home.
      if (!isCompleted && projectId !== DEMO_TUTORIAL_PROJECT_ID) return null;

      tasks.push({
        id: taskId,
        user_id: "guest",
        content,
        description,
        is_completed: isCompleted,
        completed_at: isCompleted ? dueDate : null,
        priority,
        project_id: projectId,
        day_order: tasks.length,
        created_at: new Date(date.getTime() - 86400000).toISOString(),
        updated_at: dueDate,
        due_date: dateField === "due_date" ? dueDate : null,
        do_date: dateField === "do_date" ? dueDate : null,
        is_evening: isEvening,
        parent_id: parentId,
        recurrence: null,
        recurring_series_id: null,
        google_event_id: null,
        google_etag: null,
      });

      if (isCompleted) {
        const durationSeconds = 900 + Math.floor(rng() * 7200);
        logs.push({
          id: `log-${generateId()}`,
          user_id: "guest",
          task_id: taskId,
          start_time: dueDate,
          end_time: new Date(
            date.getTime() + durationSeconds * 1000,
          ).toISOString(),
          duration_seconds: durationSeconds,
          created_at: dueDate,
        });
      }

      return taskId;
    };

    for (let i = -365; i < 0; i++) {
      const date = dayAt(i);
      const monthOffset = Math.abs(i) / 30;

      // Weight activity toward recent months to populate the heatmap.
      let probability = 0.8;
      if (monthOffset > 4) probability = 0.6;
      if (monthOffset > 8) probability = 0.45;

      if (Math.abs(i) <= 30) probability = 0.92;

      if (rng() > probability) continue;

      if (isWeekend(date)) {
        const count = rng() > 0.4 ? 2 : 1;
        for (let t = 0; t < count; t++) {
          createTask(pick(weekendLife), i, rng() > 0.75 ? pSide : pPersonal, {
            priority: randomPriority(3, 4),
            isEvening: rng() > 0.5,
            completionRate: 0.85,
          });
        }
        continue;
      }

      createTask(pick(deepWork), i, pWork, {
        priority: 2,
        completionRate: 0.85,
      });

      const collabCount = Math.abs(i) <= 30 ? 3 : 2;
      for (let t = 0; t < collabCount; t++) {
        if (rng() > 0.7) continue;
        createTask(pick(collabWork), i, pWork, {
          priority: randomPriority(1, 3),
          completionRate: 0.75,
        });
      }

      if (rng() < 0.8) {
        createTask(pick(eveningLife), i, pPersonal, {
          isEvening: true,
          completionRate: 0.8,
        });
      }
    }

    // Meet Kagelin is the only open work, so Home opens on the tutorial.
    const steps = meetKagelinSteps();
    for (const step of steps) {
      // Seeded below with a history of past weeks.
      if (step.recurrence) continue;
      const stepOptions = {
        description: step.description,
        hour: step.schedule?.hour,
        dateField: step.schedule?.field ?? null,
      };
      const stepId = createTask(
        step.content,
        0,
        DEMO_TUTORIAL_PROJECT_ID,
        stepOptions,
      );
      for (const subtask of step.subtasks ?? []) {
        createTask(subtask, 0, DEMO_TUTORIAL_PROJECT_ID, {
          ...stepOptions,
          description: undefined,
          parentId: stepId,
        });
      }
    }

    // Seed historical occurrences so Task Insights has data to chart.
    const weeklyStep = steps.find((step) => step.recurrence)!;
    const seriesId = `series-${generateId()}`;
    const seriesWeeks = 16;

    for (let w = seriesWeeks; w >= 0; w--) {
      const dueDate = new Date(now.getTime() - w * 7 * oneDay);
      dueDate.setHours(weeklyStep.schedule!.hour, 0, 0, 0);

      const isActiveOccurrence = w === 0;
      const isCompleted = !isActiveOccurrence;

      let completedAt: string | null = null;
      if (isCompleted) {
        const lateMs = rng() > 0.75 ? Math.floor(rng() * 2 * oneDay) : 0;
        completedAt = new Date(dueDate.getTime() + lateMs).toISOString();
      }

      tasks.push({
        id: `task-${generateId()}`,
        user_id: "guest",
        content: weeklyStep.content,
        description: isActiveOccurrence ? weeklyStep.description : null,
        is_completed: isCompleted,
        completed_at: completedAt,
        priority: 4,
        project_id: DEMO_TUTORIAL_PROJECT_ID,
        day_order: tasks.length,
        created_at: new Date(dueDate.getTime() - oneDay).toISOString(),
        updated_at: completedAt ?? dueDate.toISOString(),
        due_date: dueDate.toISOString(),
        do_date: null,
        is_evening: false,
        parent_id: null,
        recurrence: weeklyStep.recurrence!,
        recurring_series_id: seriesId,
        google_event_id: null,
        google_etag: null,
      });
    }

    // Like the Meet Kagelin steps, each habit shows one habit feature.
    const habit = (
      id: string,
      name: string,
      description: string,
      icon: string,
      color: string,
      frequency: { count: number; days: number },
      measurable?: { target: number; unit: string },
    ): Habit => ({
      id,
      user_id: "guest",
      name,
      description,
      color,
      icon,
      created_at: nowIso,
      updated_at: nowIso,
      archived_at: null,
      start_date: startOfHistory,
      sort_order: habits.length,
      habit_type: measurable ? "measurable" : "boolean",
      frequency_count: frequency.count,
      frequency_days: frequency.days,
      frequency_period: periodForFrequencyDays(frequency.days),
      target_type: "at_least",
      target_value: measurable?.target ?? null,
      unit: measurable?.unit ?? null,
      question: null,
      reminder_time: null,
      reminder_days: REMINDER_EVERY_DAY,
    });

    const hWater = "habit-water";
    const hRead = "habit-read";
    const hWalk = "habit-walk";
    const hStretch = "habit-stretch";
    const hCallFamily = "habit-call-family";
    const hSleep = "habit-sleep";

    for (const h of [
      habit(
        hWater,
        "Drink Water",
        "Measured: log each glass, 8 a day",
        "Droplet",
        "#5B7C99",
        { count: 1, days: 1 },
        { target: 8, unit: "glasses" },
      ),
      habit(
        hRead,
        "Read",
        "Every day, so it builds a streak",
        "Book",
        "#9F8189",
        { count: 1, days: 1 },
      ),
      habit(
        hWalk,
        "Walk",
        "5 times a week: any 5 days count",
        "Trees",
        "#A3B18A",
        { count: 5, days: 7 },
      ),
      habit(hStretch, "Stretch", "Every 2 days", "Leaf", "#6B8E8A", {
        count: 1,
        days: 2,
      }),
      habit(hCallFamily, "Call Family", "Once a week", "Heart", "#B56C5A", {
        count: 1,
        days: 7,
      }),
      habit(
        hSleep,
        "Sleep by 23:00",
        "Skip nights away: a skip keeps the streak",
        "Moon",
        "#A48C7A",
        { count: 1, days: 1 },
      ),
    ]) {
      habits.push(h);
    }

    // Frequent enough to build real streaks, but patchy day to day.
    const habitPatterns: {
      habitId: string;
      weekday: number;
      weekend: number;
      value?: () => number;
      target?: number;
      /** Chance an unmarked day is a rest day. */
      skip?: number;
      /** Days before today that are all done, so a streak shows. */
      streak?: number;
    }[] = [
      {
        habitId: hWater,
        weekday: 0.9,
        weekend: 0.8,
        value: () => 4 + Math.floor(rng() * 7),
        target: 8,
        skip: 0.1,
        streak: 9,
      },
      { habitId: hRead, weekday: 0.75, weekend: 0.8, skip: 0.15, streak: 23 },
      { habitId: hWalk, weekday: 0.75, weekend: 0.6, skip: 0.2 },
      { habitId: hStretch, weekday: 0.5, weekend: 0.5 },
      { habitId: hCallFamily, weekday: 0.1, weekend: 0.35 },
      { habitId: hSleep, weekday: 0.75, weekend: 0.4, skip: 0.3 },
    ];

    // Today stays open for the "Tick off a habit" step.
    for (let i = -365; i < 0; i++) {
      const date = dayAt(i);
      const dateStr = date.toISOString().split("T")[0];

      for (const pattern of habitPatterns) {
        const probability = isWeekend(date) ? pattern.weekend : pattern.weekday;
        let value: number;
        if (pattern.streak && -i <= pattern.streak) {
          value = pattern.target ?? ENTRY_VALUE_DONE;
        } else if (rng() < probability) {
          value = pattern.value ? pattern.value() : ENTRY_VALUE_DONE;
        } else if (pattern.skip && rng() < pattern.skip) {
          value = ENTRY_VALUE_SKIPPED;
        } else {
          continue;
        }

        entries.push({
          id: `entry-${generateId()}`,
          habit_id: pattern.habitId,
          date: dateStr,
          value,
          created_at: nowIso,
        });
      }
    }

    const mockLocations = ["Café Rosa", "Office", "Zoom", "Park", "Home"];
    const workdayEvents = [
      "Client call",
      "Team lunch",
      "Doctor's appointment",
      "Project kickoff",
      "Yoga class",
    ] as const;
    const weekendEvents = [
      "Coffee with Alex",
      "Family lunch",
      "Cinema",
      "Football in the park",
    ] as const;

    const pushEvent = (
      title: string,
      startTime: Date,
      location: string | null,
      description: string | null = null,
    ) =>
      events.push({
        id: `event-${generateId()}`,
        user_id: "guest",
        title,
        description,
        location,
        start_time: startTime.toISOString(),
        end_time: new Date(startTime.getTime() + 3600000).toISOString(),
        all_day: false,
        color: "#4B6CB7",
        category: "event",
        recurrence_rule: null,
        remote_id: null,
        remote_calendar_id: null,
        etag: null,
        ics_uid: null,
        sync_state: null,
        is_archived: false,
        reminder_minutes: null,
        metadata: {},
        created_at: nowIso,
        updated_at: nowIso,
      });

    for (let i = -7; i < 0; i++) {
      const date = dayAt(i);
      const weekend = isWeekend(date);

      if (rng() > 0.4) {
        const randomHour = weekend
          ? 11 + Math.floor(rng() * 8)
          : 9 + Math.floor(rng() * 8);
        const startTime = new Date(date);
        startTime.setHours(randomHour, 0, 0, 0);
        const title = weekend ? pick(weekendEvents) : pick(workdayEvents);
        pushEvent(title, startTime, rng() > 0.5 ? pick(mockLocations) : null);
      }
    }

    const lunch = dayAt(0);
    lunch.setHours(12, 30, 0, 0);
    pushEvent(
      "Lunch with Sam",
      lunch,
      "Café Rosa",
      "An event, not a task: it lives on the Calendar.",
    );

    return {
      tasks,
      projects,
      habits,
      habit_entries: entries,
      focus_logs: logs,
      events,
      lastUpdated: nowIso,
      seed_ids: [
        ...habits.map((h) => h.id),
        ...tasks.map((t) => t.id),
        ...projects.map((p) => p.id),
        ...events.map((e) => e.id),
      ],
    };
  }

  private loadFromStorage(): GuestData | null {
    if (typeof window === "undefined") return null;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private saveToStorage(): void {
    if (typeof window === "undefined") return;

    this.data.lastUpdated = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (error) {
      // Central write choke point: report failure once and never swallow quota errors.
      Sentry.captureException(error);
      throw new Error(
        "Failed to save guest data — browser storage may be full.",
        { cause: error },
      );
    }
  }

  getTasks(): Task[] {
    return this.data.tasks;
  }

  getTask(id: string): Task | null {
    return this.data.tasks.find((t) => t.id === id) || null;
  }

  getSubtasks(parentId: string): Task[] {
    return this.data.tasks.filter((t) => t.parent_id === parentId);
  }

  addTask(
    task: Partial<
      Omit<Task, "id" | "user_id" | "created_at" | "updated_at">
    > & {
      content: string;
      id?: string;
    },
  ): Task {
    const [newTask] = this.addTasks([task]);
    return newTask;
  }

  // One store save per batch, so a bulk import does not re-serialize per task.
  addTasks(
    tasks: Array<
      Partial<Omit<Task, "id" | "user_id" | "created_at" | "updated_at">> & {
        content: string;
        id?: string;
      }
    >,
  ): Task[] {
    if (tasks.length === 0) return [];

    const now = new Date().toISOString();
    const baseDayOrder = this.data.tasks.length;
    const newTasks: Task[] = tasks.map((task, index) => ({
      project_id: task.project_id ?? null,
      parent_id: task.parent_id ?? null,
      description: task.description ?? null,
      priority: task.priority ?? 4,
      due_date: task.due_date ?? null,
      do_date: task.do_date ?? null,
      is_evening: task.is_evening ?? false,
      is_completed: task.is_completed ?? false,
      completed_at: task.completed_at ?? null,
      day_order: task.day_order ?? baseDayOrder + index,
      recurrence: task.recurrence ?? null,
      recurring_series_id: task.recurring_series_id ?? null,
      google_event_id: task.google_event_id ?? null,
      google_etag: task.google_etag ?? null,
      content: task.content,
      id:
        task.id ||
        `guest-task-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      user_id: "guest",
      created_at: now,
      updated_at: now,
    }));

    // Inherit seed status if spawned from a demo recurring series.
    const seededIds = new Set(
      newTasks
        .filter(
          (newTask) =>
            newTask.recurring_series_id &&
            this.data.tasks.some(
              (t) =>
                t.recurring_series_id === newTask.recurring_series_id &&
                this.isSeedId(t.id),
            ),
        )
        .map((newTask) => newTask.id),
    );
    if (seededIds.size > 0) {
      this.data.seed_ids = [...(this.data.seed_ids ?? []), ...seededIds];
    }

    this.data.tasks = [...this.data.tasks, ...newTasks];
    this.saveToStorage();
    return newTasks;
  }

  updateTask(id: string, updates: Partial<Task>): Task | null {
    const index = this.data.tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;

    const updatedTasks = [...this.data.tasks];
    updatedTasks[index] = {
      ...updatedTasks[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.data.tasks = updatedTasks;

    this.saveToStorage();
    return this.data.tasks[index];
  }

  deleteTask(id: string): boolean {
    const index = this.data.tasks.findIndex((t) => t.id === id);
    if (index === -1) return false;

    this.data.tasks = this.data.tasks.filter((t) => t.id !== id);
    this.unmarkSeedId(id);
    this.saveToStorage();
    return true;
  }

  getProjects(): Project[] {
    return this.data.projects;
  }

  getProject(id: string): Project | null {
    return this.data.projects.find((p) => p.id === id) || null;
  }

  addProject(
    project: Omit<Project, "id" | "user_id" | "created_at" | "updated_at">,
  ): Project {
    const now = new Date().toISOString();
    const newProject: Project = {
      ...project,
      id: `guest-project-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      user_id: "guest",
      created_at: now,
      updated_at: now,
    };

    this.data.projects = [...this.data.projects, newProject];
    this.saveToStorage();
    return newProject;
  }

  updateProject(id: string, updates: Partial<Project>): Project | null {
    const index = this.data.projects.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const updatedProjects = [...this.data.projects];
    updatedProjects[index] = {
      ...updatedProjects[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.data.projects = updatedProjects;

    this.saveToStorage();
    return this.data.projects[index];
  }

  deleteProject(id: string): boolean {
    const index = this.data.projects.findIndex((p) => p.id === id);
    if (index === -1) return false;

    this.data.projects = this.data.projects.filter((p) => p.id !== id);
    this.unmarkSeedId(id);
    this.saveToStorage();
    return true;
  }

  deleteTasks(ids: string[]): number {
    if (ids.length === 0) return 0;

    const idSet = new Set(ids);
    const before = this.data.tasks.length;
    this.data.tasks = this.data.tasks.filter((task) => !idSet.has(task.id));
    const removed = before - this.data.tasks.length;
    if (removed === 0) return 0;

    for (const id of ids) this.unmarkSeedId(id);
    this.saveToStorage();
    return removed;
  }

  deleteProjects(ids: string[]): number {
    if (ids.length === 0) return 0;

    const idSet = new Set(ids);
    const before = this.data.projects.length;
    this.data.projects = this.data.projects.filter(
      (project) => !idSet.has(project.id),
    );
    const removed = before - this.data.projects.length;
    if (removed === 0) return 0;

    for (const id of ids) this.unmarkSeedId(id);
    this.saveToStorage();
    return removed;
  }

  moveTasksToInbox(projectId: string): void {
    let changed = false;
    this.data.tasks = this.data.tasks.map((t) => {
      if (t.project_id === projectId) {
        changed = true;
        return {
          ...t,
          project_id: null,
          updated_at: new Date().toISOString(),
        };
      }
      return t;
    });
    if (changed) this.saveToStorage();
  }

  deleteTasksByProject(projectId: string): void {
    const initialLength = this.data.tasks.length;
    this.data.tasks = this.data.tasks.filter((t) => t.project_id !== projectId);
    if (this.data.tasks.length !== initialLength) {
      this.saveToStorage();
    }
  }

  getFocusLogs(): FocusLog[] {
    return this.data.focus_logs || [];
  }

  addFocusLog(log: Omit<FocusLog, "id" | "created_at">): FocusLog {
    const now = new Date().toISOString();
    const newLog: FocusLog = {
      ...log,
      id: `guest-log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      created_at: now,
    };

    if (!this.data.focus_logs) this.data.focus_logs = [];
    this.data.focus_logs = [...this.data.focus_logs, newLog];
    this.saveToStorage();
    return newLog;
  }

  getHabits(): Habit[] {
    return this.data.habits || [];
  }

  getHabitEntries(habitId?: string): HabitEntry[] {
    if (!this.data.habit_entries) return [];
    if (habitId) {
      return this.data.habit_entries.filter((e) => e.habit_id === habitId);
    }
    return this.data.habit_entries;
  }

  addHabit(
    habit: Omit<
      Habit,
      "id" | "user_id" | "created_at" | "updated_at" | "sort_order"
    >,
  ): Habit {
    const now = new Date().toISOString();
    const newHabit: Habit = {
      ...habit,
      question: habit.question ?? null,
      reminder_time: habit.reminder_time ?? null,
      reminder_days: habit.reminder_days ?? REMINDER_EVERY_DAY,
      id: `guest-habit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_id: "guest",
      created_at: now,
      updated_at: now,
      start_date: habit.start_date || now.split("T")[0],
      sort_order: (this.data.habits || []).length,
    };

    if (!this.data.habits) this.data.habits = [];
    this.data.habits = [...this.data.habits, newHabit];
    this.saveToStorage();
    return newHabit;
  }

  updateHabit(id: string, updates: Partial<Habit>): Habit | null {
    const index = this.data.habits.findIndex((h) => h.id === id);
    if (index === -1) return null;

    const updatedHabits = [...this.data.habits];
    updatedHabits[index] = {
      ...updatedHabits[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.data.habits = updatedHabits;

    this.saveToStorage();
    return this.data.habits[index];
  }

  deleteHabit(id: string): boolean {
    const index = this.data.habits.findIndex((h) => h.id === id);
    if (index === -1) return false;

    this.data.habits = this.data.habits.filter((h) => h.id !== id);
    this.data.habit_entries = this.data.habit_entries.filter(
      (e) => e.habit_id !== id,
    );
    this.unmarkSeedId(id);

    this.saveToStorage();
    return true;
  }

  // Mirrors Supabase upsert semantics so optimistic retries converge.
  setHabitEntry(
    habitId: string,
    date: string,
    value: number,
    notes?: string | null,
  ): HabitEntry {
    const existingIndex = this.data.habit_entries.findIndex(
      (e) => e.habit_id === habitId && e.date === date,
    );

    if (existingIndex !== -1) {
      const updated: HabitEntry = {
        ...this.data.habit_entries[existingIndex],
        value,
        ...(notes !== undefined ? { notes: notes ?? null } : {}),
      };
      this.data.habit_entries = this.data.habit_entries.map((e, i) =>
        i === existingIndex ? updated : e,
      );
      this.saveToStorage();
      return updated;
    }

    const newEntry: HabitEntry = {
      id: `guest-entry-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      habit_id: habitId,
      date,
      value,
      notes: notes ?? null,
      created_at: new Date().toISOString(),
    };
    this.data.habit_entries = [...this.data.habit_entries, newEntry];
    this.saveToStorage();
    return newEntry;
  }

  clearHabitEntry(habitId: string, date: string): void {
    this.data.habit_entries = this.data.habit_entries.filter(
      (e) => !(e.habit_id === habitId && e.date === date),
    );
    this.saveToStorage();
  }

  getEvents(): CalendarEvent[] {
    return this.data.events || [];
  }

  addEvent(
    event: Omit<
      CalendarEvent,
      "id" | "user_id" | "created_at" | "updated_at"
    > & {
      id?: string;
    },
  ): CalendarEvent {
    const now = new Date().toISOString();
    const newEvent: CalendarEvent = {
      ...event,
      id:
        event.id ??
        `guest-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_id: "guest",
      created_at: now,
      updated_at: now,
    };

    if (!this.data.events) this.data.events = [];
    this.data.events = [...this.data.events, newEvent];
    this.saveToStorage();
    return newEvent;
  }

  updateEvent(
    id: string,
    updates: Partial<CalendarEvent>,
  ): CalendarEvent | null {
    const index = this.data.events?.findIndex((e) => e.id === id) ?? -1;
    if (index === -1) return null;

    const updatedEvents = [...this.data.events];
    updatedEvents[index] = {
      ...updatedEvents[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.data.events = updatedEvents;

    this.saveToStorage();
    return this.data.events[index];
  }

  deleteEvent(id: string): boolean {
    const index = this.data.events?.findIndex((e) => e.id === id) ?? -1;
    if (index === -1) return false;

    this.data.events = this.data.events.filter((e) => e.id !== id);
    this.unmarkSeedId(id);
    this.saveToStorage();
    return true;
  }

  restoreProject(project: Project): void {
    this.data.projects.push(project);
    this.saveToStorage();
  }

  restoreTask(task: Task): void {
    this.data.tasks.push(task);
    this.saveToStorage();
  }

  restoreHabit(habit: Habit): void {
    if (!this.data.habits) this.data.habits = [];
    this.data.habits.push(habit);
    this.saveToStorage();
  }

  restoreEvent(event: CalendarEvent): void {
    if (!this.data.events) this.data.events = [];
    this.data.events.push(event);
    this.saveToStorage();
  }

  restoreFocusLog(log: FocusLog): void {
    if (!this.data.focus_logs) this.data.focus_logs = [];
    this.data.focus_logs.push(log);
    this.saveToStorage();
  }

  restoreBackup(data: BackupPayload): void {
    this.data = {
      tasks: [...(data.tasks || [])],
      projects: [...(data.projects || [])],
      habits: [...(data.habits || [])],
      habit_entries: [...(data.habit_entries || [])],
      focus_logs: [...(data.focus_logs || [])],
      events: [...(data.events || [])],
      lastUpdated: new Date().toISOString(),
    };

    this.saveToStorage();
  }

  addHabitEntry(entry: HabitEntry): void {
    this.addHabitEntries([entry]);
  }

  /** Bulk insert with a single write — imports add thousands of entries. */
  addHabitEntries(entries: HabitEntry[]): void {
    if (entries.length === 0) return;
    if (!this.data.habit_entries) this.data.habit_entries = [];
    this.data.habit_entries = this.data.habit_entries.concat(entries);
    this.saveToStorage();
  }

  isSeedId(id: string): boolean {
    return (this.data.seed_ids ?? []).includes(id);
  }

  // See CONTEXT.md → Guest showcase content → Demo mode.
  isInDemoMode(): boolean {
    return (this.data.seed_ids ?? []).length > 0;
  }

  private unmarkSeedId(id: string): void {
    if (!this.data.seed_ids?.includes(id)) return;
    this.data.seed_ids = this.data.seed_ids.filter((seedId) => seedId !== id);
  }

  reset(rng: () => number = Math.random): void {
    this.data = this.getInitialData(rng);
    this.saveToStorage();
  }

  clearData(): void {
    this.data = {
      tasks: [],
      projects: [],
      habits: [],
      habit_entries: [],
      focus_logs: [],
      events: [],
      lastUpdated: new Date().toISOString(),
    };
    this.saveToStorage();
  }

  clearStorage(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

export const mockStore = new MockStore();

// Pure so migration can strip a guest blob before it reaches the singleton. See ADR 0014.
export function stripDemoData(data: GuestData): GuestData {
  const demoIds = new Set(data.seed_ids ?? []);
  if (demoIds.size === 0) return data;

  const tasks = (data.tasks ?? []).filter((t) => !demoIds.has(t.id));
  const habits = (data.habits ?? []).filter((h) => !demoIds.has(h.id));
  const keptTaskIds = new Set(tasks.map((t) => t.id));
  const keptHabitIds = new Set(habits.map((h) => h.id));

  return {
    ...data,
    tasks,
    habits,
    // A demo project still holding the Guest's own task is kept — dropping it would orphan real work.
    projects: (data.projects ?? []).filter(
      (p) => !demoIds.has(p.id) || tasks.some((t) => t.project_id === p.id),
    ),
    events: (data.events ?? []).filter((e) => !demoIds.has(e.id)),
    // Follow the parent, not the id list — else a log could outlive its task and land in real stats.
    habit_entries: (data.habit_entries ?? []).filter((e) =>
      keptHabitIds.has(e.habit_id),
    ),
    focus_logs: (data.focus_logs ?? []).filter(
      (l) => l.task_id === null || keptTaskIds.has(l.task_id),
    ),
    seed_ids: [],
  };
}
