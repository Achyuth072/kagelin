"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { parseISO } from "date-fns";
import {
  CalendarIcon,
  HomeIcon,
  CheckCircle2,
  Columns,
  LogOut,
  FolderPlus,
  Keyboard,
  Monitor,
  Copy,
  Check,
  ListFilter,
  Layers,
  Clock,
  ArchiveRestore,
  RefreshCw,
  CalendarPlus,
  LayoutGridIcon,
  MoonIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
  SearchX,
  GraduationCap,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useTaskActions } from "@/components/TaskActionsProvider";
import { useProjectActions } from "@/components/ProjectActionsProvider";
import { useHabitActions } from "@/components/habits/HabitActionsProvider";
import { useCompletedTasks } from "@/components/CompletedTasksProvider";
import { useAuth } from "@/components/AuthProvider";
import { useSidebar } from "@/components/ui/sidebar";
import { SignOutConfirmation } from "@/components/auth/SignOutConfirmation";
import { useDocumentPiP } from "@/lib/hooks/useDocumentPiP";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useUiStore } from "@/lib/store/uiStore";
import {
  useBackNavigation,
  runAfterModalBack,
} from "@/lib/hooks/useBackNavigation";
import { useAddMeetKagelin } from "@/lib/hooks/useAddMeetKagelin";
import { useCalendarStore } from "@/lib/calendar/store";
import { useTasks } from "@/lib/hooks/useTasks";
import { useHabits } from "@/lib/hooks/useHabits";
import { useCalendarEventsList } from "@/lib/hooks/useCalendarEventsList";
import { getHabitIcon } from "@/components/habits/shared/HabitIconPicker";
import type { Habit } from "@/lib/types/habit";
import { useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/notify";
import { formatModChord } from "@/lib/utils/platform";
import { ReadableText } from "@/components/encryption/ReadableText";

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandSearchResultsProps {
  search: string;
  runCommand: (command: () => void) => void;
  setSelectedTaskId: (id: string | null) => void;
  openEditHabit: (habit: Habit) => void;
  setDate: (date: Date) => void;
}

const MAX_SEARCH_RESULTS_PER_GROUP = 8;

// Rendered on open so data hooks fetch on demand rather than on page load.
function CommandSearchResults({
  search,
  runCommand,
  setSelectedTaskId,
  openEditHabit,
  setDate,
}: CommandSearchResultsProps) {
  const router = useRouter();
  const { data: tasks = [] } = useTasks();
  const { data: habits = [] } = useHabits();
  const events = useCalendarEventsList();

  const trimmed = search.trim();
  const lower = trimmed.toLowerCase();
  const isTaskOnly = lower.startsWith("t:");
  const isHabitOnly = lower.startsWith("h:");
  const isEventOnly = lower.startsWith("e:");
  const hasTypePrefix = isTaskOnly || isHabitOnly || isEventOnly;
  const rawTerm = hasTypePrefix ? trimmed.slice(2).trim() : trimmed;
  const searchTerm = rawTerm.toLowerCase();

  const filteredTasks =
    isHabitOnly || isEventOnly
      ? []
      : !searchTerm
        ? tasks.slice(0, MAX_SEARCH_RESULTS_PER_GROUP)
        : tasks
            .filter((task) =>
              (task.content ?? "").toLowerCase().includes(searchTerm),
            )
            .slice(0, MAX_SEARCH_RESULTS_PER_GROUP);

  const filteredHabits =
    isTaskOnly || isEventOnly
      ? []
      : !searchTerm
        ? habits.slice(0, MAX_SEARCH_RESULTS_PER_GROUP)
        : habits
            .filter((habit) =>
              (habit.name ?? "").toLowerCase().includes(searchTerm),
            )
            .slice(0, MAX_SEARCH_RESULTS_PER_GROUP);

  const filteredEvents =
    isTaskOnly || isHabitOnly
      ? []
      : !searchTerm
        ? events.slice(0, MAX_SEARCH_RESULTS_PER_GROUP)
        : events
            .filter((event) =>
              (event.title ?? "").toLowerCase().includes(searchTerm),
            )
            .slice(0, MAX_SEARCH_RESULTS_PER_GROUP);

  const taskItems = filteredTasks.map((task) => (
    <CommandItem
      key={task.id}
      // Ids and content in value keep individual items matchable and navigable in cmdk.
      value={`task-${task.id} ${task.content ?? ""}`}
      keywords={
        task.content === null
          ? []
          : [task.content, `t:${task.content}`, `t: ${task.content}`]
      }
      onSelect={() =>
        runCommand(() => {
          setSelectedTaskId(task.id);
          router.push("/");
        })
      }
    >
      <CheckCircle2 strokeWidth={2.25} />
      <span>
        <ReadableText text={task.content} />
      </span>
    </CommandItem>
  ));

  const habitItems = filteredHabits.map((habit) => {
    const Icon = getHabitIcon(habit.icon);
    return (
      <CommandItem
        key={habit.id}
        value={`habit-${habit.id} ${habit.name ?? ""}`}
        keywords={
          habit.name === null
            ? []
            : [habit.name, `h:${habit.name}`, `h: ${habit.name}`]
        }
        onSelect={() => runCommand(() => openEditHabit(habit))}
      >
        <Icon strokeWidth={2.25} />
        <span>
          <ReadableText text={habit.name} />
        </span>
      </CommandItem>
    );
  });

  const eventItems = filteredEvents.map((event) => (
    <CommandItem
      key={event.id}
      value={`event-${event.id} ${event.title ?? ""}`}
      keywords={
        event.title === null
          ? []
          : [event.title, `e:${event.title}`, `e: ${event.title}`]
      }
      onSelect={() =>
        runCommand(() => {
          // Local-time parse avoids timezone shift on UTC-stored all-day dates.
          setDate(parseISO(event.date.slice(0, 10)));
          router.push("/calendar");
        })
      }
    >
      <CalendarIcon strokeWidth={2.25} />
      <span>
        <ReadableText text={event.title} />
      </span>
    </CommandItem>
  ));

  if (search.length === 0) return null;

  return (
    <>
      {taskItems.length > 0 && (
        <CommandGroup heading="Tasks">{taskItems}</CommandGroup>
      )}
      {habitItems.length > 0 && (
        <CommandGroup heading="Habits">{habitItems}</CommandGroup>
      )}
      {eventItems.length > 0 && (
        <CommandGroup heading="Events">{eventItems}</CommandGroup>
      )}
    </>
  );
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showSignOutConfirm, setShowSignOutConfirm] = React.useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const { openAddTask } = useTaskActions();
  const { openCreateProject } = useProjectActions();
  const { openAddHabit, openEditHabit } = useHabitActions();
  const { openCreateEvent, setDate } = useCalendarStore();
  const { openSheet: openCompletedSheet } = useCompletedTasks();
  const { user, signOut, isGuestMode } = useAuth();
  const { toggleSidebar } = useSidebar();
  const { openPiP, closePiP, isPiPActive } = useDocumentPiP();
  const isMobile = useMediaQuery("(max-width: 640px)");
  const setShortcutsHelpOpen = useUiStore(
    (state) => state.setShortcutsHelpOpen,
  );
  const setSortBy = useUiStore((state) => state.setSortBy);
  const setGroupBy = useUiStore((state) => state.setGroupBy);
  const setArchivedProjectsOpen = useUiStore(
    (state) => state.setArchivedProjectsOpen,
  );
  const setSelectedTaskId = useUiStore((state) => state.setSelectedTaskId);
  const { addAndOpen: addMeetKagelin } = useAddMeetKagelin();
  const [copied, setCopied] = React.useState(false);
  const [search, setSearch] = React.useState("");

  useBackNavigation(open, () => onOpenChange(false));

  const runCommand = React.useCallback(
    (command: () => void) => {
      onOpenChange(false);
      runAfterModalBack(command);
    },
    [onOpenChange],
  );

  return (
    <>
      <CommandDialog open={open} onOpenChange={onOpenChange}>
        <CommandInput
          placeholder={
            isMobile
              ? "Type a command or search..."
              : "Type a command or search (or t:, h:, e:)..."
          }
          value={search}
          onValueChange={setSearch}
        />
        <CommandList className="pb-2">
          <CommandEmpty>
            <EmptyState
              icon={SearchX}
              title="No results found"
              description="Try a different search term or prefix (t:, h:, e:)."
              className="py-8 gap-3"
            />
          </CommandEmpty>

          {search === "" && (
            <>
              <CommandGroup heading="Filter by Type">
                <CommandItem onSelect={() => setSearch("t: ")}>
                  <CheckCircle2 strokeWidth={2.25} />
                  <span>Filter Tasks (t:)</span>
                  <CommandShortcut>t:</CommandShortcut>
                </CommandItem>
                <CommandItem onSelect={() => setSearch("h: ")}>
                  <Layers strokeWidth={2.25} />
                  <span>Filter Habits (h:)</span>
                  <CommandShortcut>h:</CommandShortcut>
                </CommandItem>
                <CommandItem onSelect={() => setSearch("e: ")}>
                  <CalendarIcon strokeWidth={2.25} />
                  <span>Filter Events (e:)</span>
                  <CommandShortcut>e:</CommandShortcut>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => runCommand(() => openAddTask())}>
              <PlusIcon strokeWidth={2.25} />
              <span>New Task</span>
              <CommandShortcut>N</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => openAddHabit())}>
              <PlusIcon strokeWidth={2.25} />
              <span>New Habit</span>
              <CommandShortcut>H</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => openCreateEvent())}>
              <CalendarPlus strokeWidth={2.25} />
              <span>New Event</span>
              <CommandShortcut>E</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => openCreateProject())}>
              <FolderPlus strokeWidth={2.25} />
              <span>New Project</span>
              <CommandShortcut>P</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => setArchivedProjectsOpen(true))}
            >
              <ArchiveRestore strokeWidth={2.25} />
              <span>Archived Projects</span>
              <CommandShortcut>A</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => openCompletedSheet())}
            >
              <CheckCircle2 strokeWidth={2.25} />
              <span>Show Completed Tasks</span>
              <CommandShortcut>C</CommandShortcut>
            </CommandItem>
            <CommandItem
              keywords={["tutorial", "help", "learn", "guide"]}
              onSelect={() => runCommand(() => void addMeetKagelin())}
            >
              <GraduationCap strokeWidth={2.25} />
              <span>Add Meet Kagelin Project</span>
            </CommandItem>
            {user && !isGuestMode && (
              <CommandItem
                onSelect={() =>
                  runCommand(() => {
                    queryClient.invalidateQueries();
                    notify.success("Syncing...");
                  })
                }
              >
                <RefreshCw strokeWidth={2.25} />
                <span>Sync Now</span>
              </CommandItem>
            )}
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  if (isPiPActive) closePiP();
                  else openPiP();
                })
              }
            >
              <Monitor strokeWidth={2.25} />
              <span>
                {isPiPActive ? "Close PiP Window" : "Open PiP Window"}
              </span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => toggleSidebar())}>
              <Columns strokeWidth={2.25} />
              <span>Toggle Sidebar</span>
              <CommandShortcut>{formatModChord("B")}</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          {open && (
            <CommandSearchResults
              search={search}
              runCommand={runCommand}
              setSelectedTaskId={setSelectedTaskId}
              openEditHabit={openEditHabit}
              setDate={setDate}
            />
          )}

          <CommandSeparator />

          <CommandGroup heading="Focus Sessions">
            <CommandItem
              onSelect={() =>
                runCommand(() => router.push("/focus?duration=25"))
              }
            >
              <Clock strokeWidth={2.25} />
              <span>Pomodoro (25m)</span>
              <CommandShortcut>F</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runCommand(() => router.push("/focus?duration=50"))
              }
            >
              <Clock strokeWidth={2.25} />
              <span>Deep Work (50m)</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/focus"))}
            >
              <Clock strokeWidth={2.25} />
              <span>Focus Session</span>
              <CommandShortcut>5</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="View Options">
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  setSortBy("date");
                  router.push("/");
                })
              }
            >
              <ListFilter strokeWidth={2.25} />
              <span>Sort by Date</span>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  setSortBy("priority");
                  router.push("/");
                })
              }
            >
              <ListFilter strokeWidth={2.25} />
              <span>Sort by Priority</span>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  setGroupBy("project");
                  router.push("/");
                })
              }
            >
              <Layers strokeWidth={2.25} />
              <span>Group by Project</span>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runCommand(() => {
                  setGroupBy("none");
                  router.push("/");
                })
              }
            >
              <Layers strokeWidth={2.25} />
              <span>Ungroup Tasks</span>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runCommand(() =>
                  setTheme(resolvedTheme === "light" ? "dark" : "light"),
                )
              }
            >
              {resolvedTheme === "light" ? (
                <MoonIcon strokeWidth={2.25} />
              ) : (
                <SunIcon strokeWidth={2.25} />
              )}
              <span>Toggle Dark Mode</span>
              <CommandShortcut>T</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => runCommand(() => router.push("/"))}>
              <HomeIcon strokeWidth={2.25} />
              <span>Home</span>
              <CommandShortcut>1</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/habits"))}
            >
              <Layers strokeWidth={2.25} />
              <span>Habits</span>
              <CommandShortcut>2</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/calendar"))}
            >
              <CalendarIcon strokeWidth={2.25} />
              <span>Calendar</span>
              <CommandShortcut>3</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/stats"))}
            >
              <LayoutGridIcon strokeWidth={2.25} />
              <span>Statistics</span>
              <CommandShortcut>4</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Account">
            <CommandItem
              onSelect={() => runCommand(() => router.push("/settings"))}
            >
              <SettingsIcon strokeWidth={2.25} />
              <span>Settings</span>
              <CommandShortcut>6</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => setShortcutsHelpOpen(true))}
            >
              <Keyboard strokeWidth={2.25} />
              <span>Keyboard Shortcuts</span>
              <CommandShortcut>?</CommandShortcut>
            </CommandItem>
            {user && (
              <CommandItem
                onSelect={() =>
                  runCommand(() => {
                    navigator.clipboard.writeText(user.id);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  })
                }
              >
                {copied ? (
                  <Check className="text-green-500" strokeWidth={2.25} />
                ) : (
                  <Copy strokeWidth={2.25} />
                )}
                <span>Copy My User ID</span>
              </CommandItem>
            )}
            <CommandItem
              onSelect={() => runCommand(() => setShowSignOutConfirm(true))}
              className="sumi-red-action"
            >
              <LogOut strokeWidth={2.25} />
              <span>Sign Out</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
        <div className="hidden sm:flex h-8 items-center justify-between border-t border-border bg-sidebar px-3 text-[11px] leading-none font-mono text-muted-foreground">
          <span>↑↓ Navigate · ↵ Select · Esc Close</span>
        </div>
      </CommandDialog>

      <SignOutConfirmation
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={() => {
          signOut();
          setShowSignOutConfirm(false);
        }}
      />
    </>
  );
}
