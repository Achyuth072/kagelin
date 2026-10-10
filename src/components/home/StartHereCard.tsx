"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useTaskActions } from "@/components/TaskActionsProvider";
import { useHabitActions } from "@/components/habits/HabitActionsProvider";
import { Card } from "@/components/ui/card";
import { KeyHint } from "@/components/ui/key-hint";
import { useDemoMode } from "@/lib/hooks/useDemoMode";
import { useTasks } from "@/lib/hooks/useTasks";
import { useHabits } from "@/lib/hooks/useHabits";
import { useHasFocusLog } from "@/lib/hooks/useHasFocusLog";
import { useIsBoardViewOnTasks } from "@/lib/hooks/useIsBoardViewOnTasks";
import { cn } from "@/lib/utils";

type StepId = "task" | "habit" | "focus" | "import";

interface StartHereState {
  eligible: boolean;
  dismissed: boolean;
  done: StepId[];
}

const storageKey = (userId: string) => `startHere:${userId}`;

function readState(userId: string): StartHereState | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as StartHereState) : null;
  } catch {
    return null;
  }
}

function writeState(userId: string, state: StartHereState): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // Component state still holds for this page view.
  }
}

interface Step {
  id: StepId;
  label: string;
  short?: string;
  done: boolean;
  shortcut?: string;
  onClick: () => void;
}

export function StartHereCard() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [state, setState] = useState(() => readState(userId));
  // Wait for demo check to settle: deciding while loading risks misclassifying demo accounts.
  const isDemoMode = useDemoMode();

  if (
    !userId ||
    isDemoMode !== false ||
    state?.dismissed ||
    state?.eligible === false
  ) {
    return null;
  }

  const save = (next: StartHereState) => {
    writeState(userId, next);
    setState(next);
  };

  return <StartHereSteps state={state} onChange={save} />;
}

function StartHereSteps({
  state,
  onChange,
}: {
  state: StartHereState | null;
  onChange: (next: StartHereState) => void;
}) {
  const router = useRouter();
  const { openAddTask } = useTaskActions();
  const { openAddHabit } = useHabitActions();
  const isBoardViewOnTasks = useIsBoardViewOnTasks();
  const tasksQuery = useTasks({ projectId: "all" });
  const habitsQuery = useHabits();
  const focusQuery = useHasFocusLog();
  const tasks = tasksQuery.data;
  const habits = habitsQuery.data;
  const hasFocusLog = focusQuery.data;

  const loaded = !!tasks && !!habits && hasFocusLog !== undefined;
  // Wait for background refetch so persisted cache isn't evaluated as fresh data.
  const settled =
    loaded &&
    !tasksQuery.isFetching &&
    !habitsQuery.isFetching &&
    !focusQuery.isFetching;
  const seen: Record<StepId, boolean> = {
    task: !!tasks?.length,
    habit: !!habits?.length,
    focus: !!hasFocusLog,
    import: !!habits?.some((h) => !!h.source_uuid),
  };
  const done = (id: StepId) => seen[id] || !!state?.done.includes(id);
  const newlyDone = (Object.keys(seen) as StepId[]).filter(
    (id) => seen[id] && !state?.done.includes(id),
  );

  useEffect(() => {
    if (!loaded) return;
    if (!state) {
      if (!settled) return;
      onChange({
        eligible: !seen.task && !seen.habit && !seen.focus,
        dismissed: false,
        done: newlyDone,
      });
    } else if (newlyDone.length > 0) {
      onChange({ ...state, done: [...state.done, ...newlyDone] });
    }
  });

  if (!loaded || !state) return null;

  const steps: Step[] = [
    {
      id: "task",
      label: "Add a task",
      done: done("task"),
      shortcut: "N",
      onClick: openAddTask,
    },
    {
      id: "habit",
      label: "Create a habit",
      done: done("habit"),
      // Board view claims `h` for column navigation.
      shortcut: isBoardViewOnTasks ? undefined : "H",
      onClick: openAddHabit,
    },
    {
      id: "focus",
      label: "Run a focus session",
      short: "Focus",
      done: done("focus"),
      shortcut: "F",
      onClick: () => router.push("/focus"),
    },
    {
      id: "import",
      label: "Import from Loop Habit Tracker",
      short: "Import from Loop",
      done: done("import"),
      onClick: () => router.push("/settings?tab=account"),
    },
  ];

  // Import step is optional.
  if (steps.slice(0, 3).every((step) => step.done)) return null;

  const dismiss = () => onChange({ ...state, dismissed: true });

  return <StartHereGrid steps={steps} onDismiss={dismiss} />;
}

function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      className="type-ui h-11 md:h-9 shrink-0 rounded-lg px-3 text-muted-foreground hover:bg-sidebar hover:text-foreground transition-seijaku-fast"
    >
      Dismiss
    </button>
  );
}

function StepMarker({ done, index }: { done: boolean; index: number }) {
  return (
    <span
      aria-hidden="true"
      className="w-5 shrink-0 font-mono text-[11px] tracking-[0.02em] text-muted-foreground"
    >
      {done ? (
        <Check className="h-4 w-4" strokeWidth={2.25} />
      ) : (
        String(index + 1).padStart(2, "0")
      )}
    </span>
  );
}

function StartHereGrid({
  steps,
  onDismiss,
}: {
  steps: Step[];
  onDismiss: () => void;
}) {
  return (
    <Card
      role="region"
      aria-label="Start here"
      className="mx-4 md:mx-6 mb-4 md:mb-6"
    >
      <div className="flex items-center justify-between pl-4 pr-1 pt-1">
        <h2 className="type-ui text-muted-foreground">Start here</h2>
        <DismissButton onDismiss={onDismiss} />
      </div>
      <ol className="grid grid-cols-2 md:grid-cols-4 border-t border-border/40 md:divide-x divide-border/40">
        {steps.map((step, i) => (
          <li
            key={step.id}
            className="border-border/40 max-md:odd:border-r max-md:[&:nth-child(-n+2)]:border-b"
          >
            <button
              type="button"
              onClick={step.onClick}
              className="flex w-full flex-col items-start gap-1.5 md:gap-2 px-4 py-3 md:py-4 text-left hover:bg-sidebar transition-seijaku-fast"
            >
              <StepMarker done={step.done} index={i} />
              <span
                className={cn(
                  "type-body",
                  step.done && "text-muted-foreground",
                )}
              >
                {step.done && <span className="sr-only">Done: </span>}
                <span className="md:hidden">{step.short ?? step.label}</span>
                <span className="hidden md:inline">{step.label}</span>
                {!step.done && step.shortcut && (
                  <KeyHint
                    aria-hidden="true"
                    className="ml-1.5 hidden md:pointer-fine:inline"
                  >
                    {step.shortcut}
                  </KeyHint>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </Card>
  );
}
