"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
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
  Command as CommandIcon,
  ArchiveRestore,
  RefreshCw,
  CalendarPlus,
  LayoutGridIcon,
  MoonIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
  SearchX,
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
import { useUiStore } from "@/lib/store/uiStore";
import { useBackNavigation } from "@/lib/hooks/useBackNavigation";
import { useCalendarStore } from "@/lib/calendar/store";
import { useTasks } from "@/lib/hooks/useTasks";
import { useHabits } from "@/lib/hooks/useHabits";
import { useCalendarEventsList } from "@/lib/hooks/useCalendarEventsList";
import { getHabitIcon } from "@/components/habits/shared/HabitIconPicker";
import type { Habit } from "@/lib/types/habit";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getPlatformKey } from "@/lib/utils/platform";

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

/**
 * Content-search groups (Tasks, Habits, Events) for the command menu.
 * Rendered only while the dialog is open so the data hooks fetch on open,
 * not on every cold page load; returns null until the user types.
 */
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

  if (search.length === 0) return null;

  return (
    <>
      <CommandGroup heading="Tasks">
        {tasks.map((task) => (
          <CommandItem
            key={task.id}
            value={task.content}
            onSelect={() =>
              runCommand(() => {
                setSelectedTaskId(task.id);
                router.push("/");
              })
            }
          >
            <CheckCircle2 className="mr-2 h-5 w-5" />
            <span>{task.content}</span>
          </CommandItem>
        ))}
      </CommandGroup>

      <CommandGroup heading="Habits">
        {habits.map((habit) => {
          const Icon = getHabitIcon(habit.icon);
          return (
            <CommandItem
              key={habit.id}
              value={habit.name}
              onSelect={() => runCommand(() => openEditHabit(habit))}
            >
              <Icon className="mr-2 h-5 w-5" />
              <span>{habit.name}</span>
            </CommandItem>
          );
        })}
      </CommandGroup>

      <CommandGroup heading="Events">
        {events.map((event) => (
          <CommandItem
            key={event.id}
            value={event.title}
            onSelect={() =>
              runCommand(() => {
                setDate(new Date(event.date));
                router.push("/calendar");
              })
            }
          >
            <CalendarIcon className="mr-2 h-5 w-5" />
            <span>{event.title}</span>
          </CommandItem>
        ))}
      </CommandGroup>
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
  const setShortcutsHelpOpen = useUiStore(
    (state) => state.setShortcutsHelpOpen,
  );
  const setSortBy = useUiStore((state) => state.setSortBy);
  const setGroupBy = useUiStore((state) => state.setGroupBy);
  const setArchivedProjectsOpen = useUiStore(
    (state) => state.setArchivedProjectsOpen,
  );
  const setSelectedTaskId = useUiStore((state) => state.setSelectedTaskId);
  const [copied, setCopied] = React.useState(false);
  const [search, setSearch] = React.useState("");

  // Handle back navigation to close command menu instead of navigating away
  useBackNavigation(open, () => onOpenChange(false));

  const runCommand = React.useCallback(
    (command: () => void) => {
      onOpenChange(false);
      command();
    },
    [onOpenChange],
  );

  return (
    <>
      <CommandDialog open={open} onOpenChange={onOpenChange}>
        <div className="p-6 pb-3 border-b border-border/80 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <CommandIcon className="h-5 w-5 text-muted-foreground/70" />
            <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-foreground">
              Command Menu
            </h2>
          </div>
          <p className="text-[11px] uppercase tracking-[0.02em] text-muted-foreground font-medium pt-1">
            Quick Actions & Navigation
          </p>
        </div>
        <CommandInput
          placeholder="Type a command or search..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>
            <EmptyState
              icon={SearchX}
              title="No results found"
              description="Try a different search term."
              className="py-8 gap-3"
            />
          </CommandEmpty>

          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => runCommand(() => openAddTask())}>
              <PlusIcon className="mr-2 h-5 w-5" />
              <span>New Task</span>
              <CommandShortcut>N</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => openAddHabit())}>
              <PlusIcon className="mr-2 h-5 w-5" />
              <span>New Habit</span>
              <CommandShortcut>H</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => openCreateEvent())}>
              <CalendarPlus className="mr-2 h-5 w-5" />
              <span>New Event</span>
              <CommandShortcut>E</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => openCreateProject())}>
              <FolderPlus className="mr-2 h-5 w-5" />
              <span>New Project</span>
              <CommandShortcut>P</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => setArchivedProjectsOpen(true))}
            >
              <ArchiveRestore className="mr-2 h-5 w-5" />
              <span>Archived Projects</span>
              <CommandShortcut>A</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => openCompletedSheet())}
            >
              <CheckCircle2 className="mr-2 h-5 w-5" />
              <span>Show Completed Tasks</span>
              <CommandShortcut>C</CommandShortcut>
            </CommandItem>
            {user && !isGuestMode && (
              <CommandItem
                onSelect={() =>
                  runCommand(() => {
                    queryClient.invalidateQueries();
                    toast.success("Syncing...");
                  })
                }
              >
                <RefreshCw className="mr-2 h-5 w-5" />
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
              <Monitor className="mr-2 h-5 w-5" />
              <span>
                {isPiPActive ? "Close PiP Window" : "Open PiP Window"}
              </span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => toggleSidebar())}>
              <Columns className="mr-2 h-5 w-5" />
              <span>Toggle Sidebar</span>
              <CommandShortcut>{getPlatformKey()}+B</CommandShortcut>
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
              <Clock className="mr-2 h-5 w-5" />
              <span>Pomodoro (25m)</span>
              <CommandShortcut>F</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runCommand(() => router.push("/focus?duration=50"))
              }
            >
              <Clock className="mr-2 h-5 w-5" />
              <span>Deep Work (50m)</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/focus"))}
            >
              <Clock className="mr-2 h-5 w-5" />
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
              <ListFilter className="mr-2 h-5 w-5" />
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
              <ListFilter className="mr-2 h-5 w-5" />
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
              <Layers className="mr-2 h-5 w-5" />
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
              <Layers className="mr-2 h-5 w-5" />
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
                <MoonIcon className="mr-2 h-5 w-5" />
              ) : (
                <SunIcon className="mr-2 h-5 w-5" />
              )}
              <span>Toggle Dark Mode</span>
              <CommandShortcut>T</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => runCommand(() => router.push("/"))}>
              <HomeIcon className="mr-2 h-5 w-5" />
              <span>Home</span>
              <CommandShortcut>1</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/habits"))}
            >
              <Layers className="mr-2 h-5 w-5" />
              <span>Habits</span>
              <CommandShortcut>2</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/calendar"))}
            >
              <CalendarIcon className="mr-2 h-5 w-5" />
              <span>Calendar</span>
              <CommandShortcut>3</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/stats"))}
            >
              <LayoutGridIcon className="mr-2 h-5 w-5" />
              <span>Statistics</span>
              <CommandShortcut>4</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Account">
            <CommandItem
              onSelect={() => runCommand(() => router.push("/settings"))}
            >
              <SettingsIcon className="mr-2 h-5 w-5" />
              <span>Settings</span>
              <CommandShortcut>6</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => setShortcutsHelpOpen(true))}
            >
              <Keyboard className="mr-2 h-5 w-5" />
              <span>Keyboard Shortcuts</span>
              <CommandShortcut>Shift+H</CommandShortcut>
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
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="mr-2 h-5 w-5" />
                )}
                <span>Copy My User ID</span>
              </CommandItem>
            )}
            <CommandItem
              onSelect={() => runCommand(() => setShowSignOutConfirm(true))}
              className="sumi-red-action"
            >
              <LogOut className="mr-2 h-5 w-5" />
              <span>Sign Out</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
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
