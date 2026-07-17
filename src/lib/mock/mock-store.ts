/**
 * Mock Data Store for Guest Mode
 * Provides in-memory CRUD operations with localStorage persistence
 */

import { isWeekend } from "date-fns";
import type { Task, Project } from "@/lib/types/task";
import type { RecurrenceRule } from "@/lib/utils/recurrence";
import type { Habit, HabitEntry } from "@/lib/types/habit";
import type { FocusLog } from "@/lib/types/focus";
import type { CalendarEvent } from "@/lib/types/calendar-event";
import type { BackupData } from "@/lib/backup/types";

export const STORAGE_KEY = "kanso_guest_data_v11";

interface GuestData {
  tasks: Task[];
  projects: Project[];
  habits: Habit[];
  habit_entries: HabitEntry[];
  focus_logs: FocusLog[];
  events: CalendarEvent[];
  lastUpdated: string;
}

type BackupPayload = Omit<BackupData, "metadata">;

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

  private getInitialData(): GuestData {
    const now = new Date();
    const nowIso = now.toISOString();
    const oneDay = 86400000;
    const startOfHistory = new Date(now.getTime() - 365 * oneDay)
      .toISOString()
      .split("T")[0];

    // Base Projects
    const pWork = "demo-project-work";
    const pPersonal = "demo-project-personal";
    const pSide = "demo-project-side";

    const projects: Project[] = [
      {
        id: pWork,
        user_id: "guest",
        name: "Work",
        color: "#4B6CB7", // Kagelin Blue
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
        color: "#839B82", // Muted Sage
        view_style: "list",
        is_inbox: false,
        is_archived: false,
        created_at: nowIso,
        updated_at: nowIso,
      },
      {
        id: pSide,
        user_id: "guest",
        name: "Side Project",
        color: "#8B6B80", // Plum
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

    // Generators
    const generateId = () => Math.random().toString(36).substr(2, 9);
    const pick = <T>(options: readonly T[]) =>
      options[Math.floor(Math.random() * options.length)];
    const dayAt = (dayOffset: number) =>
      new Date(now.getTime() + dayOffset * oneDay);
    const randomPriority = (min: 1 | 2 | 3, max: 3 | 4) =>
      (min + Math.floor(Math.random() * (max - min + 1))) as 1 | 2 | 3 | 4;

    const deepWork = [
      "Deep work: checkout refactor",
      "Deep work: search indexing",
      "Deep work: API rate limiting",
      "Ship feature flag rollout",
      "Trace latency regression",
      "Fix flaky integration test",
      "Write RFC for caching layer",
      "Break down the sync epic",
    ] as const;

    const collabWork = [
      "Daily standup",
      "Review pull requests",
      "Pair on onboarding bug",
      "Sprint planning",
      "Backlog grooming",
      "1:1 with manager",
      "Update the design doc",
      "Triage incoming bugs",
      "Team retro",
    ] as const;

    const eveningLife = [
      "Side project: an hour on the sync engine",
      "Read through a library's source",
      "Sketch practice",
      "Figure drawing study",
      "Ink a page",
      "Co-op session with friends",
      "Ranked matches",
      "Finish the campaign chapter",
      "Call parents",
      "Cook dinner together",
      "Board game night",
      "Read a chapter",
    ] as const;

    const sideProject = [
      "Draft the next blog post",
      "Refactor the plugin API",
      "Fix the issue a user filed",
      "Redraw the app icon",
      "Write release notes",
      "Cut a release",
    ] as const;

    const weekendLife = [
      "Long walk with family",
      "Brunch with friends",
      "Sketch at the park",
      "Side project: ship a small feature",
      "Game night",
      "Farmers market run",
      "Tidy the flat",
      "Family video call",
    ] as const;

    const createTask = (
      content: string,
      dayOffset: number,
      projectId: string,
      options: {
        priority?: 1 | 2 | 3 | 4;
        isEvening?: boolean;
        parentId?: string | null;
        // Only consulted for past days; future tasks are always pending.
        completionRate?: number;
      } = {},
    ) => {
      const {
        priority = 4,
        isEvening = false,
        parentId = null,
        completionRate = 0,
      } = options;
      const date = dayAt(dayOffset);

      // Randomize start time
      const randomHour = isEvening
        ? 18 + Math.random() * 4 // 18:00 - 22:00
        : 8 + Math.random() * 6; // 08:00 - 14:00
      const randomMinute = Math.floor(Math.random() * 60);
      date.setHours(Math.floor(randomHour), randomMinute, 0, 0);

      const dueDate = date.toISOString();
      const isPast = dayOffset < 0;
      const isCompleted = isPast && Math.random() < completionRate;

      const taskId = `task-${generateId()}`;

      tasks.push({
        id: taskId,
        user_id: "guest",
        content,
        description: null,
        is_completed: isCompleted,
        completed_at: isCompleted ? dueDate : null,
        priority,
        project_id: projectId,
        day_order: tasks.length,
        created_at: new Date(date.getTime() - 86400000).toISOString(),
        updated_at: dueDate,
        due_date: dueDate,
        do_date: null,
        is_evening: isEvening,
        parent_id: parentId,
        recurrence: null,
        recurring_series_id: null,
        google_event_id: null,
        google_etag: null,
      });

      // Add focus log if completed (simulate work done)
      if (isCompleted) {
        const durationSeconds = 900 + Math.floor(Math.random() * 7200); // 15m to 2h
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

    // Generate Past 365 Days (History for Stats)
    for (let i = -365; i < 0; i++) {
      const date = dayAt(i);
      const monthOffset = Math.abs(i) / 30;

      // Higher probability of activity overall to fill heatmap
      let probability = 0.8; // Boosted for positive stats
      if (monthOffset > 4) probability = 0.6;
      if (monthOffset > 8) probability = 0.45;

      // Special case: Very High density in the last 30 days
      if (Math.abs(i) <= 30) probability = 0.92;

      if (Math.random() > probability) continue;

      if (isWeekend(date)) {
        const count = Math.random() > 0.4 ? 2 : 1;
        for (let t = 0; t < count; t++) {
          createTask(
            pick(weekendLife),
            i,
            Math.random() > 0.75 ? pSide : pPersonal,
            {
              priority: randomPriority(3, 4),
              isEvening: Math.random() > 0.5,
              completionRate: 0.85,
            },
          );
        }
        continue;
      }

      createTask(pick(deepWork), i, pWork, {
        priority: 2,
        completionRate: 0.85,
      });

      const collabCount = Math.abs(i) <= 30 ? 3 : 2;
      for (let t = 0; t < collabCount; t++) {
        if (Math.random() > 0.7) continue;
        createTask(pick(collabWork), i, pWork, {
          priority: randomPriority(1, 3),
          completionRate: 0.75,
        });
      }

      if (Math.random() < 0.8) {
        createTask(pick(eveningLife), i, pPersonal, {
          isEvening: true,
          completionRate: 0.8,
        });
      }
    }

    // Generate Today & Future 30 Days
    for (let i = 0; i <= 30; i++) {
      // Today specific
      if (i === 0) {
        const parentId = createTask(
          "Ship search filters to staging",
          0,
          pWork,
          {
            priority: 1,
          },
        );
        createTask("Wire up the query params", 0, pWork, {
          priority: 2,
          parentId,
        });
        const subtaskId = createTask("Polish the empty state", 0, pWork, {
          priority: 3,
          parentId,
        });
        createTask("Copy review", 0, pWork, {
          priority: 3,
          parentId: subtaskId,
        });
        createTask("Loading skeleton", 0, pWork, {
          priority: 4,
          parentId: subtaskId,
        });
        createTask("Cross-browser check", 0, pWork, { priority: 2, parentId });

        createTask("Review pull requests", 0, pWork, { priority: 1 });
        createTask("Daily standup", 0, pWork, { priority: 2 });
        createTask("Call parents", 0, pPersonal, {
          priority: 3,
          isEvening: true,
        });
        createTask("Gym session", 0, pPersonal, { priority: 2 });
        createTask("Grocery run", 0, pPersonal, { priority: 4 });
        createTask("Sketch practice", 0, pPersonal, {
          priority: 4,
          isEvening: true,
        });
        continue;
      }

      if (isWeekend(dayAt(i))) {
        const count = Math.random() > 0.5 ? 2 : 1;
        for (let t = 0; t < count; t++) {
          createTask(pick(weekendLife), i, pPersonal, {
            isEvening: Math.random() > 0.5,
          });
        }
      } else {
        const isHighDensity = Math.random() > 0.8;
        const count = isHighDensity ? 4 : Math.random() > 0.4 ? 2 : 0;

        for (let t = 0; t < count; t++) {
          createTask(t === 0 ? pick(deepWork) : pick(collabWork), i, pWork, {
            priority: randomPriority(1, 3),
          });
        }

        if (Math.random() < 0.7) {
          createTask(pick(eveningLife), i, pPersonal, { isEvening: true });
        }
      }

      if (i % 3 === 0) createTask(pick(sideProject), i, pSide, { priority: 2 });
      if (i % 7 === 0)
        createTask("Weekly planning", i, pPersonal, { priority: 1 });
    }

    // Recurring task Series: ~16 weeks of history + one active Occurrence, all
    // sharing a recurring_series_id, so guest-mode Task Insights (streaks,
    // on-time %, History heatmap) has more than a single data point to chart.
    const seriesId = `series-${generateId()}`;
    const weeklyRecurrence: RecurrenceRule = { freq: "WEEKLY", interval: 1 };
    const seriesWeeks = 16;

    for (let w = seriesWeeks; w >= 0; w--) {
      const dueDate = new Date(now.getTime() - w * 7 * oneDay);
      dueDate.setHours(9, 0, 0, 0);

      const isActiveOccurrence = w === 0;
      // ~80% completion rate for past Occurrences; the current one is pending.
      const isCompleted = !isActiveOccurrence && Math.random() > 0.2;

      let completedAt: string | null = null;
      if (isCompleted) {
        // ~25% of completions run up to 2 days late.
        const lateMs =
          Math.random() > 0.75 ? Math.floor(Math.random() * 2 * oneDay) : 0;
        completedAt = new Date(dueDate.getTime() + lateMs).toISOString();
      }

      tasks.push({
        id: `task-${generateId()}`,
        user_id: "guest",
        content: "Weekly Review",
        description: null,
        is_completed: isCompleted,
        completed_at: completedAt,
        priority: 2,
        project_id: pWork,
        day_order: tasks.length,
        created_at: new Date(dueDate.getTime() - oneDay).toISOString(),
        updated_at: completedAt ?? dueDate.toISOString(),
        due_date: dueDate.toISOString(),
        do_date: null,
        is_evening: false,
        parent_id: null,
        recurrence: weeklyRecurrence,
        recurring_series_id: seriesId,
        google_event_id: null,
        google_etag: null,
      });
    }

    // Generate Habits
    const hWater = "habit-water";
    const hExercise = "habit-exercise";
    const hRead = "habit-read";
    const hSketch = "habit-sketch";
    const hSideCode = "habit-side-code";
    const hLogOff = "habit-log-off";

    habits.push(
      {
        id: hWater,
        user_id: "guest",
        name: "Drink Water",
        description: "8 glasses a day",
        color: "#5B7C99", // Earthy Blue
        icon: "Droplet",
        created_at: nowIso,
        updated_at: nowIso,
        archived_at: null,
        start_date: startOfHistory,
        sort_order: 0,
        habit_type: "measurable",
        frequency_count: 1,
        frequency_period: "day",
        target_type: "at_least",
        target_value: 8,
        unit: "glasses",
      },
      {
        id: hExercise,
        user_id: "guest",
        name: "Morning Exercise",
        description: "30 mins activity",
        color: "#A3B18A", // Muted Mint
        icon: "Dumbbell",
        created_at: nowIso,
        updated_at: nowIso,
        archived_at: null,
        start_date: startOfHistory,
        sort_order: 1,
        habit_type: "boolean",
        frequency_count: 5,
        frequency_period: "week",
        target_type: "at_least",
        target_value: null,
        unit: null,
      },
      {
        id: hRead,
        user_id: "guest",
        name: "Read",
        description: "20 pages",
        color: "#9F8189", // Lavender
        icon: "Book",
        created_at: nowIso,
        updated_at: nowIso,
        archived_at: null,
        start_date: startOfHistory,
        sort_order: 2,
        habit_type: "boolean",
        frequency_count: 7,
        frequency_period: "week",
        target_type: "at_least",
        target_value: null,
        unit: null,
      },
      {
        id: hSketch,
        user_id: "guest",
        name: "Sketch",
        description: "Fill a page",
        color: "#8B6B80", // Plum
        icon: "Pencil",
        created_at: nowIso,
        updated_at: nowIso,
        archived_at: null,
        start_date: startOfHistory,
        sort_order: 3,
        habit_type: "boolean",
        frequency_count: 3,
        frequency_period: "week",
        target_type: "at_least",
        target_value: null,
        unit: null,
      },
      {
        id: hSideCode,
        user_id: "guest",
        name: "Code for Fun",
        description: "Commit something small",
        color: "#6B8E8A", // Muted Teal
        icon: "Code",
        created_at: nowIso,
        updated_at: nowIso,
        archived_at: null,
        start_date: startOfHistory,
        sort_order: 4,
        habit_type: "boolean",
        frequency_count: 3,
        frequency_period: "week",
        target_type: "at_least",
        target_value: null,
        unit: null,
      },
      {
        id: hLogOff,
        user_id: "guest",
        name: "Log Off by 18:00",
        description: "Close the laptop, start the evening",
        color: "#A48C7A", // Warm Taupe
        icon: "Moon",
        created_at: nowIso,
        updated_at: nowIso,
        archived_at: null,
        start_date: startOfHistory,
        sort_order: 5,
        habit_type: "boolean",
        frequency_count: 4,
        frequency_period: "week",
        target_type: "at_least",
        target_value: null,
        unit: null,
      },
    );

    // Marked often enough to clear each habit's frequency_count (ADR-0004
    // streaks read those fields), but patchy day to day.
    const habitPatterns: {
      habitId: string;
      weekday: number;
      weekend: number;
      value?: () => number;
    }[] = [
      {
        habitId: hWater,
        weekday: 0.9,
        weekend: 0.8,
        value: () => 4 + Math.floor(Math.random() * 7), // 4-10 glasses
      },
      { habitId: hExercise, weekday: 0.85, weekend: 0.45 },
      { habitId: hRead, weekday: 0.6, weekend: 0.7 },
      { habitId: hSketch, weekday: 0.4, weekend: 0.6 },
      { habitId: hSideCode, weekday: 0.4, weekend: 0.65 },
      { habitId: hLogOff, weekday: 0.85, weekend: 0 },
    ];

    // Generate Habit Entries for the last 365 days
    for (let i = -365; i <= 0; i++) {
      const date = dayAt(i);
      const dateStr = date.toISOString().split("T")[0];

      for (const pattern of habitPatterns) {
        const probability = isWeekend(date) ? pattern.weekend : pattern.weekday;
        if (Math.random() >= probability) continue;

        entries.push({
          id: `entry-${generateId()}`,
          habit_id: pattern.habitId,
          date: dateStr,
          value: pattern.value ? pattern.value() : 1,
          created_at: nowIso,
        });
      }
    }

    // Generate Mock Events (Past and Future)
    const mockLocations = ["Coffee Shop", "Office", "Zoom", "Gym", "Home"];
    const workdayEvents = [
      "Design review",
      "Sprint planning",
      "1:1 with manager",
      "Team retro",
      "Architecture sync",
      "Product demo",
      "Incident postmortem",
    ] as const;
    const weekendEvents = [
      "Coffee with a friend",
      "Family lunch",
      "Life drawing class",
      "Raid night",
      "Football with the team",
    ] as const;

    for (let i = -7; i <= 14; i++) {
      const date = dayAt(i);
      const weekend = isWeekend(date);

      // Add random event
      if (Math.random() > 0.4) {
        const randomHour = weekend
          ? 11 + Math.floor(Math.random() * 8) // 11am to 6pm
          : 9 + Math.floor(Math.random() * 8); // 9am to 4pm
        const startTime = new Date(date);
        startTime.setHours(randomHour, 0, 0, 0);
        const endTime = new Date(startTime.getTime() + 3600000); // 1 hour

        const id = `event-${generateId()}`;
        const title = weekend ? pick(weekendEvents) : pick(workdayEvents);
        events.push({
          id,
          user_id: "guest",
          title: i === 0 && !weekend ? "Team catch up" : title,
          description: null,
          location: Math.random() > 0.5 ? pick(mockLocations) : null,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          all_day: false,
          color: "#4B6CB7", // Kagelin brand
          category: "event",
          recurrence_rule: null,
          remote_id: null,
          remote_calendar_id: null,
          etag: null,
          ics_uid: null,
          sync_state: null,
          is_archived: false,
          metadata: {},
          created_at: nowIso,
          updated_at: nowIso,
        });
      }
    }

    return {
      tasks,
      projects,
      habits,
      habit_entries: entries,
      focus_logs: logs,
      events,
      lastUpdated: nowIso,
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
      // Never swallow: a failed write means the guest's data is gone on
      // reload, and a silent success toast is worse than a visible error.
      throw new Error(
        "Failed to save guest data — browser storage may be full.",
        { cause: error },
      );
    }
  }

  // Task Operations
  getTasks(): Task[] {
    return this.data.tasks;
  }

  getTask(id: string): Task | null {
    return this.data.tasks.find((t) => t.id === id) || null;
  }

  addTask(
    task: Partial<
      Omit<Task, "id" | "user_id" | "created_at" | "updated_at">
    > & {
      content: string;
      id?: string;
    },
  ): Task {
    const now = new Date().toISOString();
    const newTask: Task = {
      project_id: task.project_id ?? null,
      parent_id: task.parent_id ?? null,
      description: task.description ?? null,
      priority: task.priority ?? 4,
      due_date: task.due_date ?? null,
      do_date: task.do_date ?? null,
      is_evening: task.is_evening ?? false,
      is_completed: task.is_completed ?? false,
      completed_at: task.completed_at ?? null,
      day_order: task.day_order ?? this.data.tasks.length,
      recurrence: task.recurrence ?? null,
      recurring_series_id: task.recurring_series_id ?? null,
      google_event_id: task.google_event_id ?? null,
      google_etag: task.google_etag ?? null,
      content: task.content,
      id:
        task.id ||
        `guest-task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_id: "guest",
      created_at: now,
      updated_at: now,
    };

    this.data.tasks = [...this.data.tasks, newTask];
    this.saveToStorage();
    return newTask;
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
    this.saveToStorage();
    return true;
  }

  // Project Operations
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
    this.saveToStorage();
    return true;
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

  // Focus Logs
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

  // Habit Operations
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
    // Also delete entries
    this.data.habit_entries = this.data.habit_entries.filter(
      (e) => e.habit_id !== id,
    );

    this.saveToStorage();
    return true;
  }

  // Idempotent value-set (mirrors the Supabase upsert): value 0 clears the day,
  // value > 0 writes that exact value. Repeated calls with the same value
  // converge instead of flipping, so optimistic double-taps don't desync the
  // cache from the store.
  setHabitEntry(
    habitId: string,
    date: string,
    value: number,
  ): HabitEntry | null {
    const existingIndex = this.data.habit_entries.findIndex(
      (e) => e.habit_id === habitId && e.date === date,
    );

    if (value === 0) {
      if (existingIndex !== -1) {
        this.data.habit_entries = this.data.habit_entries.filter(
          (_, i) => i !== existingIndex,
        );
        this.saveToStorage();
      }
      return null;
    }

    if (existingIndex !== -1) {
      const updated: HabitEntry = {
        ...this.data.habit_entries[existingIndex],
        value,
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
      created_at: new Date().toISOString(),
    };
    this.data.habit_entries = [...this.data.habit_entries, newEntry];
    this.saveToStorage();
    return newEntry;
  }

  // Event Operations
  getEvents(): CalendarEvent[] {
    return this.data.events || [];
  }

  addEvent(
    event: Omit<CalendarEvent, "id" | "user_id" | "created_at" | "updated_at">,
  ): CalendarEvent {
    const now = new Date().toISOString();
    const newEvent: CalendarEvent = {
      ...event,
      id: `guest-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
    this.saveToStorage();
    return true;
  }

  // Backup Restore Operations (preserve IDs and timestamps)
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

  // Utility
  reset(): void {
    this.data = this.getInitialData();
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

// Singleton instance
export const mockStore = new MockStore();
