"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useTaskActions } from "@/components/TaskActionsProvider";
import { useHabitActions } from "@/components/habits/HabitActionsProvider";
import { Card } from "@/components/ui/card";
import { KeyHint } from "@/components/ui/key-hint";
import { useAddMeetKagelin } from "@/lib/hooks/useAddMeetKagelin";
import { useIsBoardViewOnTasks } from "@/lib/hooks/useIsBoardViewOnTasks";
import { useShortcutTips } from "@/lib/hooks/useShortcutTips";
import { useStartHereCard } from "@/lib/hooks/useStartHereCard";
import type { StepId, StartHereState } from "@/lib/store/uiStore";
import { cn } from "@/lib/utils";

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
  const { state, save, isVisible, done } = useStartHereCard(userId);

  if (!isVisible || !state) {
    return null;
  }

  return <StartHereSteps state={state} onChange={save} done={done} />;
}

function StartHereSteps({
  state,
  onChange,
  done,
}: {
  state: StartHereState;
  onChange: (next: StartHereState) => void;
  done: (id: StepId) => boolean;
}) {
  const router = useRouter();
  const addMeetKagelin = useAddMeetKagelin();
  const { openAddTask } = useTaskActions();
  const { openAddHabit } = useHabitActions();
  const { recordMouseAction } = useShortcutTips();
  const isBoardViewOnTasks = useIsBoardViewOnTasks();

  const steps: Step[] = [
    {
      id: "task",
      label: "Add a task",
      done: done("task"),
      shortcut: "N",
      onClick: () => {
        recordMouseAction("newTask");
        openAddTask();
      },
    },
    {
      id: "habit",
      label: "Create a habit",
      done: done("habit"),
      // Board view claims `h` for column navigation.
      shortcut: isBoardViewOnTasks ? undefined : "H",
      onClick: () => {
        recordMouseAction("newHabit");
        openAddHabit();
      },
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

  const addTutorial = state.tutorialProjectId
    ? undefined
    : {
        pending: addMeetKagelin.isPending,
        onClick: async () => {
          const project = await addMeetKagelin.addAndOpen();
          if (project) onChange({ ...state, tutorialProjectId: project.id });
        },
      };

  return (
    <StartHereGrid
      steps={steps}
      onDismiss={dismiss}
      addTutorial={addTutorial}
    />
  );
}

const HEADER_BUTTON_CLASS =
  "type-ui h-11 md:h-9 shrink-0 rounded-lg px-3 text-muted-foreground hover:bg-sidebar hover:text-foreground transition-seijaku-fast disabled:opacity-50";

function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <button type="button" onClick={onDismiss} className={HEADER_BUTTON_CLASS}>
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
  addTutorial,
}: {
  steps: Step[];
  onDismiss: () => void;
  addTutorial?: { pending: boolean; onClick: () => void };
}) {
  return (
    <Card
      role="region"
      aria-label="Start here"
      className="mx-4 md:mx-6 mb-4 md:mb-6 overflow-hidden"
    >
      <div className="flex items-center justify-between pl-4 pr-1 pt-1">
        <h2 className="type-ui text-muted-foreground">Start here</h2>
        <div className="flex items-center">
          {addTutorial && (
            <button
              type="button"
              onClick={addTutorial.onClick}
              disabled={addTutorial.pending}
              className={cn(HEADER_BUTTON_CLASS, "text-brand")}
            >
              Add Meet Kagelin
            </button>
          )}
          <DismissButton onDismiss={onDismiss} />
        </div>
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
